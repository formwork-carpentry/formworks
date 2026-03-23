/**
 * @module @carpentry/cache
 * @description TaggedCache — enables tag-based cache invalidation
 * @patterns Decorator (wraps ICacheStore), Proxy (delegates get/put to underlying store)
 * @principles OCP (adds tagging without modifying stores), SRP (tag tracking only)
 */

import type { ICacheStore } from "@carpentry/core/contracts";
import type { MaybeAsync } from "@carpentry/core/types";

/**
 * Global tag→keys index shared across all TaggedCache instances
 * for the same underlying store. Stored as a separate concern
 * so that flush('tag') can find all keys associated with that tag.
 */
const tagIndices = new WeakMap<ICacheStore, Map<string, Set<string>>>();

function getTagIndex(store: ICacheStore): Map<string, Set<string>> {
  /**
   * @param {unknown} !tagIndices.has(store
   */
  if (!tagIndices.has(store)) {
    tagIndices.set(store, new Map());
  }
  const indices = tagIndices.get(store);
  return indices ?? new Map();
}

/**
 * TaggedCache — wraps a cache store to track tag associations.
 *
 * @example
 * ```ts
 * const tagged = new TaggedCache(store, ['posts', 'homepage']);
 * await tagged.put('recent-posts', posts, 300);
 * // Later: flush all items tagged 'posts'
 * await new TaggedCache(store, ['posts']).flush();
 * ```
 */
export class TaggedCache {
  private readonly store: ICacheStore;
  private readonly tagNames: string[];
  private readonly tagIndex: Map<string, Set<string>>;

  constructor(store: ICacheStore, tags: string[]) {
    this.store = store;
    this.tagNames = tags;
    this.tagIndex = getTagIndex(store);
  }

  /** Get a value from cache (same as underlying store) */
  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    return this.store.get<T>(key);
  }

  /** Put a value with tag tracking */
  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.store.put(key, value, ttlSeconds);
    this.trackKey(key);
  }

  /** Forget a specific key and remove from tag index */
  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async forget(key: string): Promise<boolean> {
    this.untrackKey(key);
    return this.store.forget(key);
  }

  /**
   * Flush all cache entries associated with this tag set.
   * Only removes entries that were stored via a TaggedCache with
   * at least one overlapping tag.
   */
  async flush(): Promise<void> {
    const keysToFlush = new Set<string>();
    for (const tag of this.tagNames) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of keys) keysToFlush.add(key);
        this.tagIndex.delete(tag);
      }
    }
    for (const key of keysToFlush) {
      await this.store.forget(key);
    }
  }

  /** Check if key exists */
  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  /** Remember pattern with tag tracking */
  /**
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {(} callback
   * @returns {Promise<T>}
   */
  async remember<T>(key: string, ttlSeconds: number, callback: () => MaybeAsync<T>): Promise<T> {
    const cached = await this.store.get<T>(key);
    if (cached !== null) return cached;
    const value = await callback();
    await this.put(key, value, ttlSeconds);
    return value;
  }

  /** Get all keys tracked under the current tags */
  getTaggedKeys(): string[] {
    const keys = new Set<string>();
    for (const tag of this.tagNames) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) for (const k of tagKeys) keys.add(k);
    }
    return [...keys];
  }

  private trackKey(key: string): void {
    for (const tag of this.tagNames) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)?.add(key);
    }
  }

  private untrackKey(key: string): void {
    for (const [, keys] of this.tagIndex) {
      keys.delete(key);
    }
  }
}
