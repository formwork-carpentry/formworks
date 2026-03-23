/**
 * @module @carpentry/cache
 * @description In-memory cache store with TTL — for development and testing
 * @patterns Adapter (implements ICacheStore), Flyweight (shared cache entries)
 * @principles LSP — fully substitutable for Redis/File stores; SRP — caching only
 */

import type { ICacheStore } from "@carpentry/formworks/core/contracts";
import type { MaybeAsync } from "@carpentry/formworks/core/types";
import { TaggedCache } from "../TaggedCache.js";

interface CacheEntry {
  value: unknown;
  expiresAt: number | null; // null = no expiry
}

/**
 * MemoryCacheStore — in-process `ICacheStore` with optional TTL.
 *
 * Use for development and tests. Supports tag-based invalidation via {@link TaggedCache}
 * through the `tags()` helper.
 *
 * @example
 * ```ts
 * const cache = new MemoryCacheStore();
 * await cache.put('user:1', { name: 'Alice' }, 60);
 * const u = await cache.get<{ name: string }>('user:1');
 * ```
 */
export class MemoryCacheStore implements ICacheStore {
  private store = new Map<string, CacheEntry>();

  /**
   * Get a tagged cache instance for tag-based invalidation.
   *
   * @example
   * ```ts
   * await cache.tags(['posts', 'homepage']).put('recent', data, 300);
   * await cache.tags(['posts']).flush(); // flush only 'posts' tagged items
   * ```
   */
  tags(tagNames: string[]): TaggedCache {
    return new TaggedCache(this, tagNames);
  }

  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async forget(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  /**
   * @param {string} key
   * @param {number} [value]
   * @returns {Promise<number>}
   */
  async increment(key: string, value = 1): Promise<number> {
    const entry = this.store.get(key);
    const current = entry && !this.isExpired(entry) ? (entry.value as number) : 0;
    const next = current + value;
    const expiresAt = entry?.expiresAt ?? null;
    this.store.set(key, { value: next, expiresAt });
    return next;
  }

  /**
   * @param {string} key
   * @param {number} [value]
   * @returns {Promise<number>}
   */
  async decrement(key: string, value = 1): Promise<number> {
    return this.increment(key, -value);
  }

  /**
   * @param {string[]} keys
   * @returns {Promise<Map<string, T | null>>}
   */
  async many<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }
    return result;
  }

  /**
   * @param {Map<string, unknown>} entries
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async putMany(entries: Map<string, unknown>, ttlSeconds?: number): Promise<void> {
    for (const [key, value] of entries) {
      await this.put(key, value, ttlSeconds);
    }
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

  /** Get the number of items in the store (for testing) */
  size(): number {
    // Purge expired first
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) this.store.delete(key);
    }
    return this.store.size;
  }

  private isExpired(entry: CacheEntry): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }
}
