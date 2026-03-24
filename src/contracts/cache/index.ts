/**
 * @module @carpentry/core/contracts/cache
 * @description Cache store contract - all cache adapters implement this interface.
 *
 * Implementations: MemoryCacheStore, NullCacheStore, FileCacheStore, RedisCacheStore
 *
 * @example
 * ```ts
 * const cache = container.make<ICacheStore>('cache');
 * await cache.put('user:42', { name: 'Alice' }, 3600);
 * const user = await cache.get<User>('user:42');
 * ```
 */

import type { MaybeAsync } from "@carpentry/formworks/core/types";

/** @typedef {Object} ICacheStore - Cache store contract */
export interface ICacheStore {
  /**
   * Retrieve an item from the cache.
   * @param {string} key - Cache key
   * @returns {Promise<T | null>} Cached value, or null if not found / expired
   * @example
   * ```ts
   * const user = await cache.get<User>('user:42');
   * ```
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Store an item in the cache.
   * @param {string} key - Cache key
   * @param {unknown} value - Value to store (JSON-serialized)
   * @param {number} [ttlSeconds] - Time-to-live in seconds. Omit for no expiry.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * await cache.put('user:42', { name: 'Alice' }, 3600);
   * ```
   */
  put(key: string, value: unknown, ttlSeconds?: number): Promise<void>;

  /**
   * Remove an item from the cache.
   * @param {string} key - Cache key to remove
   * @returns {Promise<boolean>} True if item existed and was removed
   */
  forget(key: string): Promise<boolean>;

  /**
   * Remove all items from the cache.
   * @returns {Promise<void>}
   */
  flush(): Promise<void>;

  /**
   * Check if a key exists in the cache.
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists and has not expired
   */
  has(key: string): Promise<boolean>;

  /**
   * Increment a numeric value atomically.
   * @param {string} key - Cache key (must contain a numeric value or not exist)
   * @param {number} [value=1] - Amount to increment by
   * @returns {Promise<number>} New value after increment
   * @example
   * ```ts
   * await cache.increment('page:views');    // 1
   * await cache.increment('page:views', 5); // 6
   * ```
   */
  increment(key: string, value?: number): Promise<number>;

  /**
   * Decrement a numeric value atomically.
   * @param {string} key - Cache key
   * @param {number} [value=1] - Amount to decrement by
   * @returns {Promise<number>} New value after decrement
   */
  decrement(key: string, value?: number): Promise<number>;

  /**
   * Retrieve multiple items at once.
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<Map<string, T | null>>} Map of key to value (null if missing)
   */
  many<T = unknown>(keys: string[]): Promise<Map<string, T | null>>;

  /**
   * Store multiple items at once.
   * @param {Map<string, unknown>} entries - Map of key-value pairs
   * @param {number} [ttlSeconds] - TTL applied to all entries
   * @returns {Promise<void>}
   */
  putMany(entries: Map<string, unknown>, ttlSeconds?: number): Promise<void>;

  /**
   * Get an item or compute and store it if missing (cache-aside pattern).
   * @param {string} key - Cache key
   * @param {number} ttlSeconds - TTL for the computed value
   * @param {Function} callback - Called to compute value on cache miss
   * @returns {Promise<T>} Cached or freshly computed value
   * @example
   * ```ts
   * const posts = await cache.remember('posts:all', 300, async () => {
   *   return Post.query().orderBy('created_at', 'desc').get();
   * });
   * ```
   */
  remember<T>(key: string, ttlSeconds: number, callback: () => MaybeAsync<T>): Promise<T>;
}
