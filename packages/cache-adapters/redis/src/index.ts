/**
 * @module @formwork/cache-redis
 * @description RedisCacheStore — production cache adapter backed by Redis via ioredis.
 *
 * Wraps ioredis with the ICacheStore interface. Uses Redis SET with EX for TTL,
 * INCRBY/DECRBY for atomic counters, MGET for bulk reads. Values are JSON-serialized.
 *
 * @patterns Adapter (ioredis → ICacheStore interface)
 * @principles LSP (substitutable for MemoryCacheStore), SRP (Redis operations only)
 *
 * @example
 * ```ts
 * import { RedisCacheStore } from '@formwork/cache-redis';
 * import Redis from 'ioredis';
 *
 * const redis = new Redis('redis://localhost:6379');
 * const cache = new RedisCacheStore(redis, { prefix: 'myapp:' });
 *
 * await cache.put('user:42', { name: 'Alice' }, 3600);
 * const user = await cache.get<User>('user:42');
 * ```
 */

import type { ICacheStore } from '@formwork/core/contracts';
import type { MaybeAsync } from '@formwork/core/types';
import type { IRedisClient, RedisCacheConfig } from './types.js';

export { type IRedisClient, type RedisCacheConfig } from './types.js';
export { MockRedisClient } from './MockRedisClient.js';

/**
 * Redis-backed cache store.
 * All values are JSON-serialized before storage and deserialized on retrieval.
 */
export class RedisCacheStore implements ICacheStore {
  private readonly prefix: string;

  constructor(
    private readonly redis: IRedisClient,
    config: RedisCacheConfig = {},
  ) {
    this.prefix = config.prefix ?? 'carpenter_cache:';
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.prefixed(key));
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; }
    catch { return raw as unknown as T; }
  }

  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(this.prefixed(key), serialized, 'EX', ttlSeconds);
    } else {
      await this.redis.set(this.prefixed(key), serialized);
    }
  }

  async forget(key: string): Promise<boolean> {
    const count = await this.redis.del(this.prefixed(key));
    return count > 0;
  }

  async flush(): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  async has(key: string): Promise<boolean> {
    return (await this.redis.exists(this.prefixed(key))) > 0;
  }

  async increment(key: string, value: number = 1): Promise<number> {
    return this.redis.incrby(this.prefixed(key), value);
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    return this.redis.incrby(this.prefixed(key), -value);
  }

  async many<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const prefixedKeys = keys.map((k) => this.prefixed(k));
    const values = await this.redis.mget(...prefixedKeys);
    const result = new Map<string, T | null>();
    keys.forEach((key, i) => {
      const raw = values[i];
      result.set(key, raw !== null ? JSON.parse(raw) as T : null);
    });
    return result;
  }

  async putMany(entries: Map<string, unknown>, ttlSeconds?: number): Promise<void> {
    for (const [key, value] of entries) await this.put(key, value, ttlSeconds);
  }

  async remember<T>(key: string, ttlSeconds: number, callback: () => MaybeAsync<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await callback();
    await this.put(key, value, ttlSeconds);
    return value;
  }

  getPrefix(): string { return this.prefix; }

  private prefixed(key: string): string { return `${this.prefix}${key}`; }
}

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@formwork/core/adapters';

/**
 * Create a CacheManager-compatible driver factory for the Redis cache adapter.
 *
 * @param clientFactory - Callback that creates an `IRedisClient` from config.
 *                        Called once per store resolution (the manager caches the result).
 * @returns A `DriverFactory` to pass to `CacheManager.registerDriver('redis', …)`.
 *
 * @example
 * ```ts
 * import Redis from 'ioredis';
 * import { createRedisCacheDriverFactory } from '@formwork/cache-redis';
 *
 * cacheManager.registerDriver('redis', createRedisCacheDriverFactory(
 *   (cfg) => new Redis(cfg['url'] as string),
 * ));
 * ```
 */
export function createRedisCacheDriverFactory(
  clientFactory: (config: Record<string, unknown>) => IRedisClient,
): CarpenterFactoryAdapter {
  return (config: { driver: string; [key: string]: unknown }) =>
    new RedisCacheStore(clientFactory(config), { prefix: config['prefix'] as string | undefined });
}
