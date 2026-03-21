/**
 * @module @formwork/tenancy
 * @description TenantScope — automatically scopes ORM queries, cache keys, and storage paths per tenant
 * @patterns Decorator (wraps QueryBuilder/CacheStore/StorageAdapter), Proxy
 * @principles SRP (scoping only), OCP (works with any adapter via wrapping)
 */

import type { Tenant } from './types.js';

// ── Tenant-Scoped Query Modifier ──────────────────────────

/**
 * Applies a tenant scope to a query builder.
 * Automatically adds a WHERE clause for the tenant column.
 *
 * @example
 * ```ts
 * const scope = new TenantScope(currentTenant, 'tenant_id');
 * const qb = scope.apply(Post.query()); // adds WHERE tenant_id = ?
 * ```
 */
export class TenantScope {
  constructor(
    private readonly tenant: Tenant,
    private readonly column: string = 'tenant_id',
  ) {}

  /**
   * Apply the tenant scope to a query builder.
   * Adds WHERE tenant_column = tenant_id.
   */
  apply<T extends { where(col: string, val: unknown): T }>(qb: T): T {
    return qb.where(this.column, this.tenant.id);
  }

  /** Get the tenant ID */
  getTenantId(): string {
    return String(this.tenant.id);
  }

  /** Get the column name used for scoping */
  getColumn(): string {
    return this.column;
  }
}

// ── Tenant-Scoped Cache ───────────────────────────────────

export interface IScopedCacheStore {
  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  get<T = unknown>(key: string): Promise<T | null>;
  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  put(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  forget(key: string): Promise<boolean>;
  flush(): Promise<void>;
  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  has(key: string): Promise<boolean>;
}

/**
 * Wraps a cache store to automatically prefix keys with the tenant ID.
 *
 * @example
 * ```ts
 * const scoped = new TenantCacheScope(innerStore, tenant);
 * await scoped.put('users', data); // actually stores "tenant_abc:users"
 * ```
 */
export class TenantCacheScope {
  private readonly prefix: string;

  constructor(
    private readonly store: IScopedCacheStore,
    tenant: Tenant,
  ) {
    this.prefix = `tenant_${tenant.id}:`;
  }

  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    return this.store.get<T>(this.prefix + key);
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    return this.store.put(this.prefix + key, value, ttlSeconds);
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async forget(key: string): Promise<boolean> {
    return this.store.forget(this.prefix + key);
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    return this.store.has(this.prefix + key);
  }

  /** Flush is intentionally NOT prefixed — use with caution */
  async flush(): Promise<void> {
    return this.store.flush();
  }

  /** Get the prefix being applied */
  getPrefix(): string {
    return this.prefix;
  }
}

// ── Tenant-Scoped Storage ─────────────────────────────────

export interface IScopedStorage {
  /**
   * @param {string} path
   * @param {Buffer | string} content
   * @returns {Promise<void>}
   */
  put(path: string, content: Buffer | string): Promise<void>;
  /**
   * @param {string} path
   * @returns {Promise<Buffer>}
   */
  get(path: string): Promise<Buffer>;
  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  exists(path: string): Promise<boolean>;
  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  delete(path: string): Promise<boolean>;
}

/**
 * Wraps a storage adapter to automatically prefix paths with the tenant ID.
 *
 * @example
 * ```ts
 * const scoped = new TenantStorageScope(disk, tenant);
 * await scoped.put('avatars/photo.png', buffer);
 * // actually stores at "tenants/abc/avatars/photo.png"
 * ```
 */
export class TenantStorageScope {
  private readonly prefix: string;

  constructor(
    private readonly storage: IScopedStorage,
    tenant: Tenant,
  ) {
    this.prefix = `tenants/${tenant.id}/`;
  }

  /**
   * @param {string} path
   * @param {Buffer | string} content
   * @returns {Promise<void>}
   */
  async put(path: string, content: Buffer | string): Promise<void> {
    return this.storage.put(this.prefix + path, content);
  }

  /**
   * @param {string} path
   * @returns {Promise<Buffer>}
   */
  async get(path: string): Promise<Buffer> {
    return this.storage.get(this.prefix + path);
  }

  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async exists(path: string): Promise<boolean> {
    return this.storage.exists(this.prefix + path);
  }

  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async delete(path: string): Promise<boolean> {
    return this.storage.delete(this.prefix + path);
  }

  /** Get the prefix being applied */
  getPrefix(): string {
    return this.prefix;
  }
}
