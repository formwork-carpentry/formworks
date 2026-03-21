/**
 * @module @formwork/cache-redis
 * @description Mock Redis client for testing — no Redis server needed.
 *
 * @example
 * ```ts
 * import { RedisCacheStore, MockRedisClient } from '@formwork/cache-redis';
 * const mock = new MockRedisClient();
 * const cache = new RedisCacheStore(mock);
 * await cache.put('key', 'value');
 * ```
 */

import type { IRedisClient } from './types.js';

/** In-memory mock that implements the IRedisClient interface for testing. */
export class MockRedisClient implements IRedisClient {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<string> {
    let expiresAt: number | null = null;
    const exIdx = args.indexOf('EX');
    if (exIdx !== -1 && typeof args[exIdx + 1] === 'number') {
      expiresAt = Date.now() + (args[exIdx + 1] as number) * 1000;
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter((k) => this.store.has(k)).length;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const entry = this.store.get(key);
    const current = entry ? Number(entry.value) || 0 : 0;
    const next = current + increment;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  async flushdb(): Promise<string> {
    this.store.clear();
    return 'OK';
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace('*', '');
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }

  async quit(): Promise<string> { return 'OK'; }

  /** Test helper: get the internal store size */
  size(): number { return this.store.size; }

  /** Test helper: clear the store */
  clear(): void { this.store.clear(); }
}
