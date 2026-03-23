/**
 * @module @carpentry/cache
 * @description Cache manager with pluggable adapters (Memory, Null, Redis via external package).
 *
 * Use this package to:
 * - Cache values with TTL using a named store (`CacheManager.store()`)
 * - Swap cache drivers by config/driver name (register your own drivers)
 * - Invalidate cache by tags with {@link TaggedCache}
 *
 * @example
 * ```ts
 * import { CacheManager, TaggedCache } from './';
 *
 * const manager = new CacheManager('memory', {
 *   memory: { driver: 'memory' },
 * });
 *
 * const cache = manager.store();
 * await cache.put('posts:list', { total: 10 }, 60);
 *
 * const tagged = new TaggedCache(cache, ['posts']);
 * await tagged.put('posts:list', { total: 10 }, 60);
 * await tagged.flush(); // invalidates only keys stored with these tags
 * ```
 *
 * @see CacheManager — Resolve named cache stores
 * @see TaggedCache — Tag-based invalidation
 */

export { MemoryCacheStore } from "./adapters/MemoryCacheStore.js";
export { NullCacheStore } from "./adapters/NullCacheStore.js";
export { FileCacheStore } from "./adapters/FileCacheStore.js";
export { TaggedCache } from "./TaggedCache.js";
export { CacheManager, setCacheManager, Cache, createCacheManager } from "./manager/index.js";
export type { CacheStoreConfig, CacheDriverFactory as CacheStoreFactory } from "./manager/index.js";
export { RedisCacheStore, MockRedisClient } from "./adapters/RedisCacheStore.js";
export type { IRedisClient, RedisCacheConfig } from "./adapters/RedisCacheStore.js";
