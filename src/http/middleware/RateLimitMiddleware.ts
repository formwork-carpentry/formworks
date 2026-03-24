/**
 * @module @carpentry/http
 * @description Rate limiting middleware — sliding window per-client request throttling
 * @patterns Strategy (configurable key resolver, limit handler)
 * @principles SRP (rate limiting only), OCP (configurable via options)
 */

import type { Request } from "../request/Request.js";
import { CarpenterResponse } from "../response/Response.js";

export interface RateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
  keyResolver?: (request: Request) => string;
  onLimitExceeded?: (request: Request, retryAfterSeconds: number) => CarpenterResponse;
}

interface RateLimitEntry {
  timestamps: number[];
}

/**
 * RateLimitMiddleware — throttles requests per client in a sliding time window.
 *
 * Tracks request timestamps per key and, when the limit is exceeded, returns the
 * response from `onLimitExceeded()` (defaults to a 429 JSON response).
 *
 * @example
 * ```ts
 * // Configure via middleware pipeline:
 * const limiter = new RateLimitMiddleware({ maxRequests: 100, windowSeconds: 60 });
 * // Use limiter in HttpKernel global middleware
 * ```
 */
export class RateLimitMiddleware {
  private store = new Map<string, RateLimitEntry>();
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      keyResolver: (req) => req.header("x-forwarded-for") ?? req.header("x-real-ip") ?? "unknown",
      onLimitExceeded: (_req, retryAfter) => {
        const res = CarpenterResponse.json(
          { error: "Too many requests.", retry_after: retryAfter },
          429,
        );
        res.header("Retry-After", String(retryAfter));
        return res;
      },
      ...options,
    };
  }

  /**
   * @param {Request} request
   * @param {(} next
   * @returns {CarpenterResponse | Promise<CarpenterResponse>}
   */
  handle(
    request: Request,
    next: () => CarpenterResponse | Promise<CarpenterResponse>,
  ): CarpenterResponse | Promise<CarpenterResponse> {
    const key = this.options.keyResolver(request);
    const now = Date.now();
    const windowMs = this.options.windowSeconds * 1000;
    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }
    entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);

    if (entry.timestamps.length >= this.options.maxRequests) {
      const oldestInWindow = entry.timestamps[0] ?? now;
      const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      return this.options.onLimitExceeded?.(request, retryAfter);
    }

    entry.timestamps.push(now);
    const remaining = this.options.maxRequests - entry.timestamps.length;
    const responseOrPromise = next();
    const addHeaders = (res: CarpenterResponse): CarpenterResponse => {
      res.header("X-RateLimit-Limit", String(this.options.maxRequests));
      res.header("X-RateLimit-Remaining", String(remaining));
      return res;
    };
    if (responseOrPromise instanceof Promise) return responseOrPromise.then(addHeaders);
    return addHeaders(responseOrPromise);
  }

  /**
   * @param {string} key
   * @returns {number}
   */
  remaining(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return this.options.maxRequests;
    const now = Date.now();
    const windowMs = this.options.windowSeconds * 1000;
    const active = entry.timestamps.filter((t) => t > now - windowMs);
    return Math.max(0, this.options.maxRequests - active.length);
  }

  reset(): void {
    this.store.clear();
  }
  /**
   * @param {string} key
   */
  resetKey(key: string): void {
    this.store.delete(key);
  }
}
