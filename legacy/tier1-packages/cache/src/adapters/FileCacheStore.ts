/**
 * @module @carpentry/cache
 * @description FileCacheStore — persistent file-based cache with TTL
 * @patterns Adapter (implements ICacheStore)
 * @principles LSP (substitutable for Memory/Redis), SRP (file-based caching only)
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { ICacheStore } from "@carpentry/core/contracts";
import type { MaybeAsync } from "@carpentry/core/types";

interface FileCacheEntry {
  value: unknown;
  expiresAt: number | null;
}

/**
 * File-based cache store. Each key becomes a JSON file on disk.
 *
 * @example
 * ```ts
 * const cache = new FileCacheStore({ directory: '/app/storage/cache' });
 * await cache.put('users:active', activeUsers, 3600);
 * const users = await cache.get('users:active');
 * ```
 */
export class FileCacheStore implements ICacheStore {
  private readonly dir: string;

  constructor(config: { directory: string }) {
    this.dir = config.directory;
  }

  /**
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const data = await fs.readFile(this.path(key), "utf-8");
      const entry: FileCacheEntry = JSON.parse(data);
      if (this.isExpired(entry)) {
        await this.forget(key);
        return null;
      }
      return entry.value as T;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const entry: FileCacheEntry = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    };
    const filePath = this.path(key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(entry));
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async forget(key: string): Promise<boolean> {
    try {
      await fs.unlink(this.path(key));
      return true;
    } catch {
      return false;
    }
  }

  async flush(): Promise<void> {
    try {
      await fs.rm(this.dir, { recursive: true, force: true });
      await fs.mkdir(this.dir, { recursive: true });
    } catch {
      // Directory may not exist
    }
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /**
   * @param {string} key
   * @param {number} [value]
   * @returns {Promise<number>}
   */
  async increment(key: string, value = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + value;
    await this.put(key, next);
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
    for (const key of keys) result.set(key, await this.get<T>(key));
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

  private path(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex");
    // Use first 2 chars as subdirectory for distribution
    return join(this.dir, hash.slice(0, 2), `${hash}.json`);
  }

  private isExpired(entry: FileCacheEntry): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }
}
