/**
 * @module @carpentry/cache
 * @description Null cache store — always misses, never stores. For testing "no cache" scenarios.
 * @patterns Null Object
 * @principles LSP — substitutable for any ICacheStore
 */

import type { ICacheStore } from "@carpentry/formworks/core/contracts";
import type { MaybeAsync } from "@carpentry/formworks/core/types";

/**
 * NullCacheStore — no-op cache that always misses.
 *
 * Useful when you want the same `ICacheStore` call sites but caching is disabled
 * (e.g. tests or "cache off" config). `remember()` always runs the callback.
 *
 * @example
 * ```ts
 * const cache = new NullCacheStore();
 * await cache.put('k', 1);
 * const v = await cache.remember('k', 60, async () => 42);
 * // v === 42
 * ```
 */
export class NullCacheStore implements ICacheStore {
  /**
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(_key: string): Promise<T | null> {
    return null;
  }
  /**
   * @returns {Promise<void>}
   */
  async put(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void> {}
  /**
   * @returns {Promise<boolean>}
   */
  async forget(_key: string): Promise<boolean> {
    return false;
  }
  async flush(): Promise<void> {}
  /**
   * @returns {Promise<boolean>}
   */
  async has(_key: string): Promise<boolean> {
    return false;
  }
  /**
   * @returns {Promise<number>}
   */
  async increment(_key: string, _value?: number): Promise<number> {
    return 0;
  }
  /**
   * @returns {Promise<number>}
   */
  async decrement(_key: string, _value?: number): Promise<number> {
    return 0;
  }
  /**
   * @param {string[]} keys
   * @returns {Promise<Map<string, T | null>>}
   */
  async many<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const map = new Map<string, T | null>();
    for (const k of keys) map.set(k, null);
    return map;
  }
  /**
   * @returns {Promise<void>}
   */
  async putMany(_entries: Map<string, unknown>, _ttlSeconds?: number): Promise<void> {}
  /**
   * @param {(} callback
   * @returns {Promise<T>}
   */
  async remember<T>(_key: string, _ttlSeconds: number, callback: () => MaybeAsync<T>): Promise<T> {
    return callback();
  }
}
