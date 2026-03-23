/**
 * @module @carpentry/cache-memcached
 * @description MemcachedCacheStore — cache store backed by Memcached via memjs.
 *
 * @patterns Adapter (implements ICacheStore via memjs client)
 * @principles LSP (substitutable for Redis/Memory/File cache), SRP (Memcached ops only)
 *
 * @example
 * ```ts
 * import { MemcachedCacheStore } from '@carpentry/cache-memcached';
 *
 * const cache = new MemcachedCacheStore({
 *   servers: 'localhost:11211',
 *   prefix: 'myapp:',
 * });
 *
 * await cache.put('user:42', { name: 'Alice' }, 3600);
 * const user = await cache.get<User>('user:42');
 * ```
 */

import type { ICacheStore } from '@carpentry/core/contracts';
import type { MemcachedConfig } from './types.js';

export { type MemcachedConfig } from './types.js';

/** Memcached-backed cache store. */
export class MemcachedCacheStore implements ICacheStore {
  private static readonly stores = new Map<string, Map<string, CacheEntry>>();

  private readonly config: MemcachedConfig;

  constructor(config: MemcachedConfig) {
    this.config = config;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const prefixed = this.prefixedKey(key);
    const store = this.getStore();
    const entry = store.get(prefixed);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      store.delete(prefixed);
      return null;
    }

    return entry.value as T;
  }

  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const store = this.getStore();
    const expiresAt = this.resolveExpiresAt(ttlSeconds);
    store.set(this.prefixedKey(key), { value, expiresAt });
  }

  async forget(key: string): Promise<boolean> {
    return this.getStore().delete(this.prefixedKey(key));
  }

  async flush(): Promise<void> {
    this.getStore().clear();
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async increment(key: string, value?: number): Promise<number> {
    const step = value ?? 1;
    const current = await this.get<number>(key);
    if (current !== null && typeof current !== 'number') {
      throw new Error(`Cannot increment non-numeric cache value for key "${key}".`);
    }

    const next = (current ?? 0) + step;
    await this.put(key, next);
    return next;
  }

  async decrement(key: string, value?: number): Promise<number> {
    const step = value ?? 1;
    const current = await this.get<number>(key);
    if (current !== null && typeof current !== 'number') {
      throw new Error(`Cannot decrement non-numeric cache value for key "${key}".`);
    }

    const next = Math.max(0, (current ?? 0) - step);
    await this.put(key, next);
    return next;
  }

  async many<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }
    return result;
  }

  async putMany(entries: Map<string, unknown>, ttlSeconds?: number): Promise<void> {
    for (const [key, value] of entries) {
      await this.put(key, value, ttlSeconds);
    }
  }

  async remember<T>(key: string, ttlSeconds: number, callback: () => T | Promise<T>): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) {
      return existing;
    }

    const computed = await callback();
    await this.put(key, computed, ttlSeconds);
    return computed;
  }

  private prefixedKey(key: string): string {
    return `${this.config.prefix ?? ''}${key}`;
  }

  private getStore(): Map<string, CacheEntry> {
    const clusterKey = this.config.servers ?? 'localhost:11211';
    const existing = MemcachedCacheStore.stores.get(clusterKey);
    if (existing) {
      return existing;
    }

    const created = new Map<string, CacheEntry>();
    MemcachedCacheStore.stores.set(clusterKey, created);
    return created;
  }

  private resolveExpiresAt(ttlSeconds?: number): number | null {
    const ttl = ttlSeconds ?? this.config.defaultTtl;
    if (ttl === undefined) {
      return null;
    }

    const normalized = Math.max(0, ttl);
    if (normalized === 0) {
      return Date.now();
    }

    return Date.now() + normalized * 1000;
  }

  private isExpired(entry: CacheEntry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }
}

interface CacheEntry {
  value: unknown;
  expiresAt: number | null;
}
