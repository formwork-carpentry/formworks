/**
 * @module @formwork/session
 * @description FileSessionStore — persists sessions as JSON files on disk
 * @patterns Adapter (implements ISessionStore)
 * @principles LSP (substitutable for Memory/Redis/DB stores), SRP (file I/O only)
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

/** Session store interface (duplicated to avoid circular import) */
export interface IFileSessionStore {
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
}

interface SessionData {
  data: Record<string, unknown>;
  lastAccessed: number;
}

/**
 * File-based session store. Each session is a JSON file.
 *
 * @example
 * ```ts
 * const store = new FileSessionStore({ directory: '/app/storage/sessions', ttlMinutes: 120 });
 * await store.put('user_id', 42);
 * const userId = await store.get<number>('user_id');
 * ```
 */
export class FileSessionStore implements IFileSessionStore {
  private readonly dir: string;
  private readonly ttlMs: number;
  private sessionId: string;
  private cache: Record<string, unknown> | null = null;

  constructor(config: { directory: string; sessionId?: string; ttlMinutes?: number }) {
    this.dir = config.directory;
    this.sessionId = config.sessionId ?? this.generateId();
    this.ttlMs = (config.ttlMinutes ?? 120) * 60 * 1000;
  }

  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const data = await this.loadSession();
    return (data[key] as T) ?? null;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown): Promise<void> {
    const data = await this.loadSession();
    data[key] = value;
    await this.saveSession(data);
  }

  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async forget(key: string): Promise<void> {
    const data = await this.loadSession();
    delete data[key];
    await this.saveSession(data);
  }

  async flush(): Promise<void> {
    this.cache = null;
    try {
      await fs.unlink(this.filePath());
    } catch {
      // File may not exist
    }
  }

  /** Get the current session ID */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Regenerate the session ID (e.g., after login) */
  async regenerate(): Promise<string> {
    const data = await this.loadSession();
    await this.flush();
    this.sessionId = this.generateId();
    this.cache = null;
    await this.saveSession(data);
    return this.sessionId;
  }

  /** Delete expired session files (garbage collection) */
  async gc(): Promise<number> {
    let cleaned = 0;
    try {
      const entries = await fs.readdir(this.dir, { withFileTypes: true });
      const now = Date.now();
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        const path = join(this.dir, entry.name);
        try {
          const raw = await fs.readFile(path, 'utf-8');
          const session: SessionData = JSON.parse(raw);
          if (now - session.lastAccessed > this.ttlMs) {
            await fs.unlink(path);
            cleaned++;
          }
        } catch {
          // Corrupt file, remove it
          await fs.unlink(path).catch(() => {});
          cleaned++;
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return cleaned;
  }

  private async loadSession(): Promise<Record<string, unknown>> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath(), 'utf-8');
      const session: SessionData = JSON.parse(raw);
      if (Date.now() - session.lastAccessed > this.ttlMs) {
        this.cache = {};
        return this.cache;
      }
      this.cache = session.data;
      return this.cache;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  private async saveSession(data: Record<string, unknown>): Promise<void> {
    this.cache = data;
    const session: SessionData = { data, lastAccessed: Date.now() };
    const path = this.filePath();
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(session));
  }

  private filePath(): string {
    const hash = createHash('sha256').update(this.sessionId).digest('hex');
    return join(this.dir, `${hash}.json`);
  }

  private generateId(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
