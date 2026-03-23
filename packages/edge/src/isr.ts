/**
 * @module @carpentry/edge
 * @description ISR (Incremental Static Regeneration) + CDN cache middleware.
 *
 * Provides stale-while-revalidate caching, Surrogate-Key headers for CDN
 * tag-based purging (Fastly, Cloudflare, Akamai), and a purge API.
 *
 * @example
 * ```ts
 * const isr = new IsrCache({ defaultTtl: 300, swr: 60 });
 *
 * // In a route handler:
 * const page = await isr.handle('/blog/post-1', async () => {
 *   return { html: renderPost(post), tags: ['posts', 'post:1'] };
 * });
 *
 * // Purge by tag when content changes:
 * await isr.purgeTag('posts');
 * ```
 */

/** @typedef {Object} IsrConfig */
export interface IsrConfig {
  /** @property {number} defaultTtl - Default cache TTL in seconds (default: 300) */
  defaultTtl?: number;
  /** @property {number} swrSeconds - Stale-while-revalidate window in seconds (default: 60) */
  swrSeconds?: number;
  /** @property {string} surrogateKeyHeader - Header name for CDN tags (default: 'Surrogate-Key') */
  surrogateKeyHeader?: string;
}

/** @typedef {Object} IsrEntry - A cached ISR page entry */
export interface IsrEntry {
  /** @property {string} body - Cached response body */
  body: string;
  /** @property {Record<string, string>} headers - Cached response headers */
  headers: Record<string, string>;
  /** @property {number} status - HTTP status code */
  status: number;
  /** @property {string[]} tags - Cache tags for invalidation */
  tags: string[];
  /** @property {number} createdAt - Timestamp when cached */
  createdAt: number;
  /** @property {number} ttl - TTL in seconds */
  ttl: number;
  /** @property {boolean} revalidating - True if background revalidation is in progress */
  revalidating: boolean;
}

/** @typedef {Object} IsrResult - Result from ISR handler */
export interface IsrResult {
  body: string;
  status?: number;
  headers?: Record<string, string>;
  tags?: string[];
  ttl?: number;
}

/**
 * ISR Cache — serves stale content while revalidating in the background.
 *
 * @example
 * ```ts
 * const isr = new IsrCache({ defaultTtl: 600, swrSeconds: 120 });
 *
 * // Cache a page render
 * const result = await isr.handle('/blog/post-1', async () => ({
 *   body: '<html>...</html>',
 *   tags: ['posts', 'post:1', 'author:42'],
 *   ttl: 300,
 * }));
 *
 * // result.headers includes:
 * // Cache-Control: public, max-age=300, stale-while-revalidate=120
 * // Surrogate-Key: posts post:1 author:42
 *
 * // When a post is updated:
 * isr.purgeTag('post:1');  // Invalidates just this post
 * isr.purgeTag('posts');   // Invalidates all post pages
 * ```
 */
export class IsrCache {
  private cache = new Map<string, IsrEntry>();
  private config: Required<IsrConfig>;

  /**
   * @param {IsrConfig} [config] - ISR configuration
   */
  constructor(config: IsrConfig = {}) {
    this.config = {
      defaultTtl: config.defaultTtl ?? 300,
      swrSeconds: config.swrSeconds ?? 60,
      surrogateKeyHeader: config.surrogateKeyHeader ?? "Surrogate-Key",
    };
  }

  /**
   * Serve a cached page or generate and cache a new one.
   *
   * @param {string} key - Cache key (usually the URL path)
   * @param {Function} generate - Async function that generates the page
   * @returns {Promise<{body: string, status: number, headers: Record<string,string>}>}
   */
  async handle(
    key: string,
    generate: () => Promise<IsrResult>,
  ): Promise<{ body: string; status: number; headers: Record<string, string> }> {
    const existing = this.cache.get(key);
    const now = Date.now();

    if (existing) {
      const ageSeconds = (now - existing.createdAt) / 1000;
      const isStale = ageSeconds > existing.ttl;
      const isBeyondSwr = ageSeconds > existing.ttl + this.config.swrSeconds;

      if (!isStale) {
        return this.buildResponse(existing, ageSeconds);
      }

      if (!isBeyondSwr && !existing.revalidating) {
        existing.revalidating = true;
        this.revalidate(key, generate);
        return this.buildResponse(existing, ageSeconds);
      }

      if (isBeyondSwr) {
        this.cache.delete(key);
      }
    }

    const result = await generate();
    const entry = this.store(key, result);
    return this.buildResponse(entry, 0);
  }

  /**
   * Purge all entries tagged with a given tag.
   *
   * @param {string} tag - Cache tag to purge (e.g., 'posts', 'post:42')
   * @returns {number} Number of entries purged
   */
  purgeTag(tag: string): number {
    let purged = 0;
    for (const [key, entry] of this.cache) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Purge a specific cache key.
   *
   * @param {string} key - Cache key to purge
   * @returns {boolean} True if the entry existed and was purged
   */
  purgeKey(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Purge all cached entries.
   *
   * @returns {number} Number of entries purged
   */
  purgeAll(): number {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  /**
   * Get cache stats.
   *
   * @returns {{ size: number, keys: string[] }}
   */
  stats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: [...this.cache.keys()] };
  }

  private store(key: string, result: IsrResult): IsrEntry {
    const entry: IsrEntry = {
      body: result.body,
      headers: result.headers ?? {},
      status: result.status ?? 200,
      tags: result.tags ?? [],
      createdAt: Date.now(),
      ttl: result.ttl ?? this.config.defaultTtl,
      revalidating: false,
    };
    this.cache.set(key, entry);
    return entry;
  }

  private buildResponse(
    entry: IsrEntry,
    ageSeconds: number,
  ): { body: string; status: number; headers: Record<string, string> } {
    const headers: Record<string, string> = {
      ...entry.headers,
      "cache-control": `public, max-age=${entry.ttl}, stale-while-revalidate=${this.config.swrSeconds}`,
      age: String(Math.floor(ageSeconds)),
    };
    if (entry.tags.length > 0) {
      headers[this.config.surrogateKeyHeader] = entry.tags.join(" ");
    }
    return { body: entry.body, status: entry.status, headers };
  }

  private async revalidate(key: string, generate: () => Promise<IsrResult>): Promise<void> {
    try {
      const result = await generate();
      this.store(key, result);
    } catch {
      const existing = this.cache.get(key);
      if (existing) existing.revalidating = false;
    }
  }
}
