/**
 * @module @formwork/core/contracts/cache
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
export {};
//# sourceMappingURL=index.js.map