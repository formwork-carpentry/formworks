/**
 * @module @formwork/cache-redis
 * @description Type definitions for the Redis cache adapter.
 */

/** ioredis-compatible interface — allows mock injection for testing */
export interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  mget(...keys: string[]): Promise<Array<string | null>>;
  flushdb(): Promise<string>;
  keys(pattern: string): Promise<string[]>;
  quit(): Promise<string>;
}

/** Configuration for RedisCacheStore */
export interface RedisCacheConfig {
  /** Key prefix to namespace cache entries (default: 'carpenter_cache:') */
  prefix?: string;
}
