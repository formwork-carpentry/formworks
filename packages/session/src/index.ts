/**
 * @module @formwork/session
 * @description Session system — flash data, CSRF tokens, old input, and pluggable stores.
 *
 * Use this package to:
 * - Persist user session data via an {@link ISessionStore}
 * - Flash success/error messages for the next request (`session.flash()`)
 * - Preserve form input across redirects (`session.flashInput()`, `session.old()`)
 * - Generate and verify CSRF tokens (`session.token()`, `session.verifyToken()`)
 *
 * @patterns Strategy (session stores), Proxy (Session wraps store with flash/CSRF logic),
 *           Memento (old input preservation across redirects)
 * @principles OCP — new stores (Redis, File, DB) without modifying Session; SRP — user API lives in Session
 *
 * @example
 * ```ts
 * import { SessionManager } from '@formwork/session';
 *
 * const manager = new SessionManager('memory');
 * const session = manager.create(); // default driver
 *
 * await session.start();
 * await session.put('user_id', 1);
 * await session.flash('success', 'Saved.');
 *
 * const csrf = await session.token();
 * // Render: <input type="hidden" name="_csrf" value={csrf} />
 *
 * await session.save();
 * ```
 */

import { randomBytes, timingSafeEqual } from 'crypto';

// ── Session Store Interface ───────────────────────────────

export interface ISessionStore {
  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  get<T = unknown>(key: string): Promise<T | null>;
  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  put(key: string, value: unknown): Promise<void>;
  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  forget(key: string): Promise<void>;
  flush(): Promise<void>;
  all(): Promise<Record<string, unknown>>;
  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  has(key: string): Promise<boolean>;
  getId(): string;
  /**
   * @param {string} id
   */
  setId(id: string): void;
  save(): Promise<void>;
}

// ── MemorySessionStore ────────────────────────────────────

/**
 * MemorySessionStore — in-memory {@link ISessionStore} for tests and dev.
 *
 * Data lives only in a `Map`; `save()` is a no-op. Use {@link SessionStoreRegistry}
 * when you need multiple isolated session IDs in one process.
 *
 * @example
 * ```ts
 * const store = new MemorySessionStore();
 * await store.put('cart', { items: [] });
 * expect(await store.get('cart')).toEqual({ items: [] });
 * ```
 */
export class MemorySessionStore implements ISessionStore {
  private data = new Map<string, unknown>();
  private sessionId: string;

  constructor(id?: string) {
    this.sessionId = id ?? this.generateId();
  }

  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async forget(key: string): Promise<void> {
    this.data.delete(key);
  }

  async flush(): Promise<void> {
    this.data.clear();
  }

  async all(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const [k, v] of this.data) result[k] = v;
    return result;
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  getId(): string { return this.sessionId; }

  /**
   * @param {string} id
   */
  setId(id: string): void { this.sessionId = id; }

  async save(): Promise<void> {
    // In-memory — nothing to persist. Real stores write to Redis/DB/file here.
  }

  /** Get raw data size (for testing) */
  size(): number { return this.data.size; }

  private generateId(): string {
    return randomBytes(20).toString('hex');
  }
}

// ── Session — user-facing API with flash, CSRF, old input ──

/**
 * User-facing session API built on top of an {@link ISessionStore}.
 *
 * This class provides:
 * - Basic key/value session storage (`get`, `put`, `forget`)
 * - Flash data that survives exactly one subsequent request (`flash`, `reflash`, `keep`)
 * - Old input helpers for validation flows (`flashInput`, `old`)
 * - CSRF token helpers (`token`, `verifyToken`, `regenerateToken`)
 *
 * @example
 * ```ts
 * const session = new Session(store);
 * await session.start();
 *
 * await session.put('user_id', 1);
 * await session.flash('success', 'Profile updated.');
 *
 * const token = await session.token();
 * await session.save();
 * ```
 *
 * @see {@link ISessionStore}
 * @see {@link SessionManager}
 */
export class Session {
  private store: ISessionStore;
  private flashKeys: Set<string> = new Set();
  private newFlashKeys: Set<string> = new Set();
  private started = false;

  constructor(store: ISessionStore) {
    this.store = store;
  }

  /** Start the session — loads flash keys from previous request */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Load previous flash keys
    const prevFlash = await this.store.get<string[]>('_flash_keys');
    if (prevFlash) {
      for (const key of prevFlash) this.flashKeys.add(key);
    }
  }

  // ── Basic CRUD ──────────────────────────────────────────

  /**
   * @param {string} key
   * @param {T} [defaultValue]
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T | null> {
    const value = await this.store.get<T>(key);
    if (value !== null) return value;
    return defaultValue !== undefined ? defaultValue : null;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown): Promise<void> {
    await this.store.put(key, value);
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async forget(key: string): Promise<void> {
    await this.store.forget(key);
  }

  async all(): Promise<Record<string, unknown>> {
    return this.store.all();
  }

  async flush(): Promise<void> {
    await this.store.flush();
    this.flashKeys.clear();
    this.newFlashKeys.clear();
  }

  // ── Flash Data ──────────────────────────────────────────
  // Flash data lives for exactly ONE subsequent request, then is removed.
  // Used for: success messages, error messages, validation errors after redirect.

  /** Set a flash value (available on the next request only) */
  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async flash(key: string, value: unknown): Promise<void> {
    await this.store.put(key, value);
    this.newFlashKeys.add(key);
  }

  /** Keep current flash data for one more request */
  async reflash(): Promise<void> {
    for (const key of this.flashKeys) {
      this.newFlashKeys.add(key);
    }
  }

  /** Keep specific flash keys for one more request */
  /**
   * @param {string[]} ...keys
   * @returns {Promise<void>}
   */
  async keep(...keys: string[]): Promise<void> {
    for (const key of keys) {
      if (this.flashKeys.has(key)) {
        this.newFlashKeys.add(key);
      }
    }
  }

  // ── Old Input ───────────────────────────────────────────
  // Preserves form input across redirects (e.g., validation failure → back to form)

  /** Flash all form input so it's available on the next request */
  /**
   * @param {Object} input
   * @returns {Promise<void>}
   */
  async flashInput(input: Record<string, unknown>): Promise<void> {
    await this.flash('_old_input', input);
  }

  /** Get old input from the previous request */
  /**
   * @param {string} key
   * @param {T} [defaultValue]
   * @returns {Promise<T | null>}
   */
  async old<T = unknown>(key: string, defaultValue?: T): Promise<T | null> {
    const input = await this.store.get<Record<string, unknown>>('_old_input');
    const value = input?.[key];
    if (value !== undefined && value !== null) return value as T;
    return defaultValue !== undefined ? defaultValue : null;
  }

  /** Check if old input exists for a key */
  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async hasOldInput(key: string): Promise<boolean> {
    const input = await this.store.get<Record<string, unknown>>('_old_input');
    return input !== null && key in input;
  }

  // ── CSRF Token ──────────────────────────────────────────

  /** Get or generate the CSRF token */
  async token(): Promise<string> {
    let token = await this.store.get<string>('_csrf_token');
    if (!token) {
      token = randomBytes(32).toString('hex');
      await this.store.put('_csrf_token', token);
    }
    return token;
  }

  /** Regenerate the CSRF token */
  async regenerateToken(): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.store.put('_csrf_token', token);
    return token;
  }

  /** Verify a CSRF token against the session token */
  /**
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async verifyToken(token: string): Promise<boolean> {
    const sessionToken = await this.store.get<string>('_csrf_token');
    if (sessionToken === null) return false;
    const a = Buffer.from(sessionToken);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  // ── Session ID ──────────────────────────────────────────

  /** Get the session ID */
  getId(): string { return this.store.getId(); }

  /** Regenerate the session ID (after login for security) */
  async regenerate(): Promise<string> {
    const newId = randomBytes(20).toString('hex');
    this.store.setId(newId);
    return newId;
  }

  // ── Lifecycle ───────────────────────────────────────────

  /** Save the session — cleans up expired flash data */
  async save(): Promise<void> {
    // Remove old flash keys that weren't reflashed
    for (const key of this.flashKeys) {
      if (!this.newFlashKeys.has(key)) {
        await this.store.forget(key);
      }
    }

    // Store new flash keys for next request
    if (this.newFlashKeys.size > 0) {
      await this.store.put('_flash_keys', [...this.newFlashKeys]);
    } else {
      await this.store.forget('_flash_keys');
    }

    await this.store.save();
  }

  /** Get the underlying store (for testing) */
  getStore(): ISessionStore { return this.store; }
}

// ── SessionManager — resolves session stores ──────────────

export type SessionStoreFactory = (config: Record<string, unknown>) => ISessionStore;

/**
 * Session manager that resolves session stores and creates {@link Session} instances.
 *
 * Use `registerDriver()` to add additional store implementations (file/DB/Redis/etc.),
 * then `create()` to instantiate a session for a driver.
 *
 * @example
 * ```ts
 * const manager = new SessionManager('memory');
 * const session = manager.create(); // memory store by default
 *
 * await session.start();
 * await session.put('user_id', 123);
 * await session.flash('success', 'Signed in.');
 * await session.save();
 * ```
 *
 * @see {@link Session} — Session API with flash, CSRF, and old input helpers
 */
export class SessionManager {
  private factories = new Map<string, SessionStoreFactory>();
  private defaultDriver: string;

  constructor(defaultDriver: string = 'memory') {
    this.defaultDriver = defaultDriver;
    this.registerDriver('memory', () => new MemorySessionStore());
  }

  /**
   * @param {string} name
   * @param {SessionStoreFactory} factory
   * @returns {this}
   */
  registerDriver(name: string, factory: SessionStoreFactory): this {
    this.factories.set(name, factory);
    return this;
  }

  /** Create a new session with the specified or default driver */
  /**
   * @param {string} [driver]
   * @param {Object} [config]
   * @returns {Session}
   */
  create(driver?: string, config: Record<string, unknown> = {}): Session {
    const driverName = driver ?? this.defaultDriver;
    const factory = this.factories.get(driverName);
    if (!factory) throw new Error(`Session driver "${driverName}" not registered.`);
    return new Session(factory(config));
  }

  getDefaultDriver(): string { return this.defaultDriver; }
}

// ── Session Store: Stores keyed by session ID (for multi-session testing) ──

/**
 * SessionStoreRegistry — map session IDs to distinct {@link MemorySessionStore} instances.
 *
 * Handy in tests when multiple users/sessions must not share the same backing store.
 *
 * @example
 * ```ts
 * const registry = new SessionStoreRegistry();
 * const a = registry.resolve('sess-a');
 * const b = registry.resolve('sess-b');
 * await a.put('x', 1);
 * expect(await b.get('x')).toBeNull();
 * ```
 */
export class SessionStoreRegistry {
  private stores = new Map<string, MemorySessionStore>();

  /** Get or create a store for a session ID */
  /**
   * @param {string} sessionId
   * @returns {MemorySessionStore}
   */
  resolve(sessionId: string): MemorySessionStore {
    if (!this.stores.has(sessionId)) {
      this.stores.set(sessionId, new MemorySessionStore(sessionId));
    }
    return this.stores.get(sessionId)!;
  }

  /** Destroy a session */
  /**
   * @param {string} sessionId
   * @returns {boolean}
   */
  destroy(sessionId: string): boolean {
    return this.stores.delete(sessionId);
  }

  /** Get all active session IDs */
  activeSessions(): string[] {
    return [...this.stores.keys()];
  }

  /** Clear all sessions */
  clear(): void { this.stores.clear(); }
}

export { FileSessionStore } from './FileSessionStore.js';
