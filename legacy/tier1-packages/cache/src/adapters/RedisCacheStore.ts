/**
 * @module @carpentry/cache
 * @description RedisCacheStore — production cache adapter backed by Redis via ioredis.
 *
 * WHY: In-memory and file caches don't survive process restarts or work across
 * multiple server instances. Redis provides shared, persistent, sub-millisecond
 * caching for distributed deployments.
 *
 * HOW: Wraps ioredis with the ICacheStore interface. Uses Redis SET with EX for TTL,
 * INCRBY/DECRBY for atomic counters, MGET for bulk reads. Values are JSON-serialized.
 *
 * @patterns Adapter (ioredis → ICacheStore interface)
 * @principles LSP (substitutable for MemoryCacheStore), SRP (Redis operations only)
 *
 * @example
 * ```ts
 * import Redis from 'ioredis';
 *
 * const redis = new Redis('redis://localhost:6379');
 * const cache = new RedisCacheStore(redis, { prefix: 'myapp:' });
 *
 * await cache.put('user:42', { name: 'Alice' }, 3600); // TTL: 1 hour
 * const user = await cache.get('user:42');
 * ```
 */

import type { ICacheStore } from "@carpentry/core/contracts";
import type { MaybeAsync } from "@carpentry/core/types";

/** ioredis-compatible interface — allows mock injection for testing */
export interface IRedisClient {
  /**
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  get(key: string): Promise<string | null>;
  /**
   * @param {string} key
   * @param {string} value
   * @param {unknown[]} ...args
   * @returns {Promise<unknown>}
   */
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  /**
   * @param {string[]} ...keys
   * @returns {Promise<number>}
   */
  del(...keys: string[]): Promise<number>;
  /**
   * @param {string[]} ...keys
   * @returns {Promise<number>}
   */
  exists(...keys: string[]): Promise<number>;
  /**
   * @param {string} key
   * @param {number} increment
   * @returns {Promise<number>}
   */
  incrby(key: string, increment: number): Promise<number>;
  /**
   * @param {string[]} ...keys
   * @returns {Promise<Array<string | null>>}
   */
  mget(...keys: string[]): Promise<Array<string | null>>;
  flushdb(): Promise<string>;
  /**
   * @param {string} pattern
   * @returns {Promise<string[]>}
   */
  keys(pattern: string): Promise<string[]>;
  quit(): Promise<string>;
}

export interface RedisCacheConfig {
  /** Key prefix to namespace cache entries (default: 'carpenter_cache:') */
  prefix?: string;
}

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
    this.prefix = config.prefix ?? "carpenter_cache:";
  }

  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.prefixed(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(this.prefixed(key), serialized, "EX", ttlSeconds);
    } else {
      await this.redis.set(this.prefixed(key), serialized);
    }
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async forget(key: string): Promise<boolean> {
    const count = await this.redis.del(this.prefixed(key));
    return count > 0;
  }

  async flush(): Promise<void> {
    // Delete only keys with our prefix (safer than FLUSHDB)
    const keys = await this.redis.keys(`${this.prefix}*`);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    return (await this.redis.exists(this.prefixed(key))) > 0;
  }

  /**
   * @param {string} key
   * @param {number} [value]
   * @returns {Promise<number>}
   */
  async increment(key: string, value = 1): Promise<number> {
    return this.redis.incrby(this.prefixed(key), value);
  }

  /**
   * @param {string} key
   * @param {number} [value]
   * @returns {Promise<number>}
   */
  async decrement(key: string, value = 1): Promise<number> {
    return this.redis.incrby(this.prefixed(key), -value);
  }

  /**
   * @param {string[]} keys
   * @returns {Promise<Map<string, T | null>>}
   */
  async many<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const prefixedKeys = keys.map((k) => this.prefixed(k));
    const values = await this.redis.mget(...prefixedKeys);
    const result = new Map<string, T | null>();
    keys.forEach((key, i) => {
      const raw = values[i];
      result.set(key, raw !== null ? (JSON.parse(raw) as T) : null);
    });
    return result;
  }

  /**
   * @param {Map<string, unknown>} entries
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async putMany(entries: Map<string, unknown>, ttlSeconds?: number): Promise<void> {
    for (const [key, value] of entries) await this.put(key, value, ttlSeconds);
  }

  /**
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {(} callback
   * @returns {Promise<T>}
   */
  async remember<T>(key: string, ttlSeconds: number, callback: () => MaybeAsync<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await callback();
    await this.put(key, value, ttlSeconds);
    return value;
  }

  /** Get the key prefix (useful for debugging) */
  getPrefix(): string {
    return this.prefix;
  }

  private prefixed(key: string): string {
    return this.prefix + key;
  }
}

/**
 * In-memory mock Redis client for testing.
 * Implements IRedisClient without needing a real Redis server.
 *
 * @example
 * ```ts
 * const mockRedis = new MockRedisClient();
 * const cache = new RedisCacheStore(mockRedis);
 * await cache.put('key', 'value', 60);
 * expect(await cache.get('key')).toBe('value');
 * ```
 */
export class MockRedisClient implements IRedisClient {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  /**
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {string} value
   * @param {unknown[]} ...args
   * @returns {Promise<string>}
   */
  async set(key: string, value: string, ...args: unknown[]): Promise<string> {
    let expiresAt: number | null = null;
    // Parse EX ttl from args: set(key, value, 'EX', seconds)
    const exIdx = args.indexOf("EX");
    if (exIdx >= 0 && typeof args[exIdx + 1] === "number") {
      expiresAt = Date.now() + (args[exIdx + 1] as number) * 1000;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  /**
   * @param {string[]} ...keys
   * @returns {Promise<number>}
   */
  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  /**
   * @param {string[]} ...keys
   * @returns {Promise<number>}
   */
  async exists(...keys: string[]): Promise<number> {
    return keys.filter((k) => this.store.has(k)).length;
  }

  /**
   * @param {string} key
   * @param {number} increment
   * @returns {Promise<number>}
   */
  async incrby(key: string, increment: number): Promise<number> {
    const current = Number.parseInt((await this.get(key)) ?? "0", 10);
    const next = current + increment;
    await this.set(key, String(next));
    return next;
  }

  /**
   * @param {string[]} ...keys
   * @returns {Promise<Array<string | null>>}
   */
  async mget(...keys: string[]): Promise<Array<string | null>> {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  async flushdb(): Promise<string> {
    this.store.clear();
    return "OK";
  }
  /**
   * @param {string} pattern
   * @returns {Promise<string[]>}
   */
  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace("*", "");
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
  async quit(): Promise<string> {
    return "OK";
  }
}
