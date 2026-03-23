/**
 * @module @carpentry/cache
 * @description CacheManager — resolves cache stores by name from configuration.
 * Extends {@link CarpenterFactoryBase} for shared driver registration, lazy resolution, and instance caching.
 *
 * @patterns Abstract Factory (creates stores by driver name), Strategy (driver swapping)
 * @principles DIP — app code uses ICacheStore, never a concrete store; OCP — new drivers via register
 *             DRY — shared resolution logic via CarpenterFactoryBase
 */

import { CarpenterFactoryBase } from "@carpentry/formworks/core/adapters";
import type { ICacheStore } from "@carpentry/formworks/core/contracts";
import type { MaybeAsync } from "@carpentry/formworks/core/types";
import { MemoryCacheStore } from "../adapters/MemoryCacheStore.js";
import { NullCacheStore } from "../adapters/NullCacheStore.js";

export interface CacheStoreConfig {
  driver: string;
  [key: string]: unknown;
}

export type CacheStoreFactory = (config: CacheStoreConfig) => ICacheStore;

/**
 * Resolve cache stores by name and proxy the `ICacheStore` interface to a default store.
 *
 * `CacheManager` implements `ICacheStore` itself by delegating calls to the selected store
 * returned from {@link store()}.
 *
 * @example
 * ```ts
 * import { CacheManager } from '..';
 *
 * const manager = new CacheManager('memory', {
 *   memory: { driver: 'memory' },
 * });
 *
 * const cache = manager.store();
 * await cache.put('user:1', { id: 1, name: 'Alice' }, 300);
 * const user = await cache.get('user:1');
 * ```
 *
 * @see TaggedCache — Invalidate by tags
 * @see CarpenterFactoryBase — shared driver registration and resolution
 */
export class CacheManager
  extends CarpenterFactoryBase<ICacheStore, CacheStoreConfig>
  implements ICacheStore
{
  protected readonly resolverLabel = "store";
  protected readonly domainLabel = "Cache";

  constructor(defaultStore = "memory", configs: Record<string, CacheStoreConfig> = {}) {
    super(defaultStore, configs);

    // Register built-in drivers
    this.registerDriver("memory", () => new MemoryCacheStore());
    this.registerDriver("null", () => new NullCacheStore());
  }

  /** Get a specific cache store by name */
  /**
   * @param {string} [name]
   * @returns {ICacheStore}
   */
  store(name?: string): ICacheStore {
    return this.resolve(name);
  }

  // ── Proxy to default store (ICacheStore interface) ──────

  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    return this.store().get<T>(key);
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    return this.store().put(key, value, ttlSeconds);
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async forget(key: string): Promise<boolean> {
    return this.store().forget(key);
  }

  async flush(): Promise<void> {
    return this.store().flush();
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    return this.store().has(key);
  }

  /**
   * @param {string} key
   * @param {number} [value]
   * @returns {Promise<number>}
   */
  async increment(key: string, value?: number): Promise<number> {
    return this.store().increment(key, value);
  }

  /**
   * @param {string} key
   * @param {number} [value]
   * @returns {Promise<number>}
   */
  async decrement(key: string, value?: number): Promise<number> {
    return this.store().decrement(key, value);
  }

  /**
   * @param {string[]} keys
   * @returns {Promise<Map<string, T | null>>}
   */
  async many<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    return this.store().many<T>(keys);
  }

  /**
   * @param {Map<string, unknown>} entries
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async putMany(entries: Map<string, unknown>, ttlSeconds?: number): Promise<void> {
    return this.store().putMany(entries, ttlSeconds);
  }

  /**
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {() => MaybeAsync<T>} callback
   * @returns {Promise<T>}
   */
  async remember<T>(key: string, ttlSeconds: number, callback: () => MaybeAsync<T>): Promise<T> {
    return this.store().remember<T>(key, ttlSeconds, callback);
  }
}

// ── Cache Facade ──────────────────────────────────────────

let globalCacheManager: CacheManager | null = null;

/** Set the global cache manager (called during Application boot) */
/**
 * @param {CacheManager} manager
 */
export function setCacheManager(manager: CacheManager): void {
  globalCacheManager = manager;
}

/** Static Cache facade — Laravel-style Cache.get(), Cache.put() */
export const Cache = {
  get: <T = unknown>(key: string) => getCacheManager().get<T>(key),
  put: (key: string, value: unknown, ttl?: number) => getCacheManager().put(key, value, ttl),
  forget: (key: string) => getCacheManager().forget(key),
  flush: () => getCacheManager().flush(),
  has: (key: string) => getCacheManager().has(key),
  increment: (key: string, value?: number) => getCacheManager().increment(key, value),
  decrement: (key: string, value?: number) => getCacheManager().decrement(key, value),
  remember: <T>(key: string, ttl: number, cb: () => MaybeAsync<T>) =>
    getCacheManager().remember<T>(key, ttl, cb),
  store: (name?: string) => getCacheManager().store(name),
};

function getCacheManager(): CacheManager {
  /**
   * @param {unknown} !globalCacheManager
   */
  if (!globalCacheManager) {
    throw new Error("CacheManager not initialized. Call setCacheManager() during boot.");
  }
  return globalCacheManager;
}
