/**
 * @module @carpentry/edge
 * @description Incremental Static Regeneration (ISR) and CDN cache management.
 *
 * @example
 * ```ts
 * const isr = new IsrManager({ defaultTtl: 300, staleWhileRevalidate: 60 });
 * const response = await isr.handle(request, async () => renderPage('/blog'));
 * // Sets: Cache-Control: public, s-maxage=300, stale-while-revalidate=60
 * // Sets: Surrogate-Key: page:/blog posts
 *
 * // Purge by tag:
 * await isr.purgeTag('posts');
 * ```
 */

/**
 * @typedef {Object} IsrConfig
 * @property {number} [defaultTtl=300] - Default cache TTL in seconds
 * @property {number} [staleWhileRevalidate=60] - SWR window in seconds
 * @property {string} [cdnProvider='generic'] - CDN provider for purge API
 * @property {string} [purgeEndpoint] - CDN purge API endpoint
 * @property {string} [purgeToken] - CDN purge API token
 */
export interface IsrConfig {
  defaultTtl?: number;
  staleWhileRevalidate?: number;
  cdnProvider?: "generic" | "fastly" | "cloudflare" | "vercel";
  purgeEndpoint?: string;
  purgeToken?: string;
}

/**
 * @typedef {Object} IsrPage - Cached page data
 */
export interface IsrPage {
  body: string;
  headers: Record<string, string>;
  tags: string[];
  generatedAt: number;
  ttl: number;
}

/**
 * IsrManager — Incremental Static Regeneration with tag-based cache invalidation.
 *
 * @example
 * ```ts
 * const isr = new IsrManager({ defaultTtl: 300 });
 *
 * // In a route handler:
 * const page = await isr.render('/blog', ['posts', 'page:/blog'], async () => {
 *   return { body: renderHtml(), headers: { 'content-type': 'text/html' } };
 * });
 *
 * // When content changes:
 * await isr.purgeTag('posts'); // Invalidates all pages tagged with 'posts'
 * ```
 */
export class IsrManager {
  private cache = new Map<string, IsrPage>();
  private tagIndex = new Map<string, Set<string>>();
  private config: Required<IsrConfig>;

  /**
   * @param {IsrConfig} [config] - ISR configuration
   */
  constructor(config: IsrConfig = {}) {
    this.config = {
      defaultTtl: config.defaultTtl ?? 300,
      staleWhileRevalidate: config.staleWhileRevalidate ?? 60,
      cdnProvider: config.cdnProvider ?? "generic",
      purgeEndpoint: config.purgeEndpoint ?? "",
      purgeToken: config.purgeToken ?? "",
    };
  }

  /**
   * Render a page with ISR caching.
   *
   * @param {string} path - Page path (cache key)
   * @param {string[]} tags - Cache tags for invalidation
   * @param {Function} render - Async function that generates the page
   * @param {number} [ttl] - Override TTL for this page
   * @returns {Promise<{body: string, headers: Record<string, string>}>}
   */
  async render(
    path: string,
    tags: string[],
    render: () => Promise<{ body: string; headers?: Record<string, string> }>,
    ttl?: number,
  ): Promise<{ body: string; headers: Record<string, string> }> {
    const pageTtl = ttl ?? this.config.defaultTtl;
    const cached = this.cache.get(path);
    const now = Date.now();

    if (cached) {
      const age = (now - cached.generatedAt) / 1000;
      if (age < cached.ttl) {
        return { body: cached.body, headers: this.cacheHeaders(cached, age) };
      }
      if (age < cached.ttl + this.config.staleWhileRevalidate) {
        this.revalidateInBackground(path, tags, render, pageTtl);
        return {
          body: cached.body,
          headers: { ...this.cacheHeaders(cached, age), "x-isr-state": "stale" },
        };
      }
    }

    const result = await render();
    this.store(path, result.body, result.headers ?? {}, tags, pageTtl);
    const storedEntry = this.cache.get(path);
    return { body: result.body, headers: storedEntry ? this.cacheHeaders(storedEntry, 0) : {} };
  }

  /**
   * Purge all pages tagged with a given tag.
   *
   * @param {string} tag - Cache tag to purge
   * @returns {Promise<number>} Number of pages purged
   */
  async purgeTag(tag: string): Promise<number> {
    const paths = this.tagIndex.get(tag);
    if (!paths) return 0;

    let count = 0;
    for (const path of paths) {
      this.cache.delete(path);
      count++;
    }
    this.tagIndex.delete(tag);
    return count;
  }

  /**
   * Purge a specific path.
   *
   * @param {string} path - Path to purge
   * @returns {boolean} True if the path was cached
   */
  purgePath(path: string): boolean {
    const existed = this.cache.has(path);
    this.cache.delete(path);
    for (const [, paths] of this.tagIndex) paths.delete(path);
    return existed;
  }

  /**
   * Purge all cached pages.
   * @returns {number} Number of pages purged
   */
  purgeAll(): number {
    const count = this.cache.size;
    this.cache.clear();
    this.tagIndex.clear();
    return count;
  }

  /**
   * Get cache statistics.
   * @returns {{ pages: number, tags: number }}
   */
  getStats(): { pages: number; tags: number } {
    return { pages: this.cache.size, tags: this.tagIndex.size };
  }

  private store(
    path: string,
    body: string,
    headers: Record<string, string>,
    tags: string[],
    ttl: number,
  ): void {
    this.cache.set(path, { body, headers, tags, generatedAt: Date.now(), ttl });
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)?.add(path);
    }
  }

  private cacheHeaders(page: IsrPage, ageSecs: number): Record<string, string> {
    return {
      ...page.headers,
      "cache-control": `public, s-maxage=${page.ttl}, stale-while-revalidate=${this.config.staleWhileRevalidate}`,
      "surrogate-key": page.tags.join(" "),
      "x-isr-age": String(Math.round(ageSecs)),
      "x-isr-state": "fresh",
    };
  }

  private revalidateInBackground(
    path: string,
    tags: string[],
    render: () => Promise<{ body: string; headers?: Record<string, string> }>,
    ttl: number,
  ): void {
    render()
      .then((result) => {
        this.store(path, result.body, result.headers ?? {}, tags, ttl);
      })
      .catch(() => {});
  }
}
