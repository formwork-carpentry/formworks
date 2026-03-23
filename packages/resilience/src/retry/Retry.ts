/**
 * @module @carpentry/resilience
 * @description Retry with backoff strategies and in-memory Rate Limiter
 * @patterns Strategy (backoff strategies)
 * @principles SRP — retry logic only; OCP — new backoff strategies
 */

export type BackoffStrategy = "fixed" | "linear" | "exponential" | "jitter";

export interface RetryOptions {
  /** Max retry attempts (default: 3) */
  times?: number;
  /** Base delay in ms (default: 1000) */
  delay?: number;
  /** Backoff strategy (default: 'exponential') */
  backoff?: BackoffStrategy;
  /** Which errors to retry on (default: all) */
  retryOn?: (error: Error) => boolean;
}

/**
 * Retry a function with configurable backoff.
 *
 * @example
 * ```typescript
 * const result = await retry(() => fetchFromApi(), { times: 3, backoff: 'exponential' });
 * ```
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { times = 3, delay = 1000, backoff = "exponential", retryOn } = options;
  let lastError: Error | undefined;

  /**
   * @param {unknown} [let attempt = 0; attempt <= times; attempt++]
   */
  for (let attempt = 0; attempt <= times; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === times) break;
      if (retryOn && !retryOn(lastError)) break;

      const waitMs = computeDelay(delay, attempt, backoff);
      await sleep(waitMs);
    }
  }

  throw lastError;
}

function computeDelay(base: number, attempt: number, strategy: BackoffStrategy): number {
  /**
   * @param {unknown} strategy
   */
  switch (strategy) {
    case "fixed":
      return base;
    case "linear":
      return base * (attempt + 1);
    case "exponential":
      return base * 2 ** attempt;
    case "jitter": {
      const exp = base * 2 ** attempt;
      return Math.floor(Math.random() * exp);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Rate Limiter ──────────────────────────────────────────

export interface RateLimiterOptions {
  maxAttempts: number;
  decaySeconds: number;
}

/**
 * In-memory rate limiter — tracks attempts per key with sliding window.
 * In production, back this with Redis for distributed rate limiting.
 */
export class RateLimiter {
  private attempts = new Map<string, { count: number; expiresAt: number }>();

  /** Check if an attempt is allowed. Returns true if under limit. */
  /**
   * @param {string} key
   * @param {number} maxAttempts
   * @param {number} decaySeconds
   * @returns {boolean}
   */
  attempt(key: string, maxAttempts: number, decaySeconds: number): boolean {
    this.cleanup(key);

    const entry = this.attempts.get(key);
    if (!entry) {
      this.attempts.set(key, { count: 1, expiresAt: Date.now() + decaySeconds * 1000 });
      return true;
    }

    if (entry.count >= maxAttempts) {
      return false;
    }

    entry.count++;
    return true;
  }

  /** Get remaining attempts for a key */
  /**
   * @param {string} key
   * @param {number} maxAttempts
   * @returns {number}
   */
  remaining(key: string, maxAttempts: number): number {
    this.cleanup(key);
    const entry = this.attempts.get(key);
    if (!entry) return maxAttempts;
    return Math.max(0, maxAttempts - entry.count);
  }

  /** Get seconds until the rate limit window resets */
  /**
   * @param {string} key
   * @returns {number}
   */
  retryAfter(key: string): number {
    const entry = this.attempts.get(key);
    if (!entry) return 0;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  /** Clear rate limit for a key */
  /**
   * @param {string} key
   */
  clear(key: string): void {
    this.attempts.delete(key);
  }

  /** Reset all rate limits */
  reset(): void {
    this.attempts.clear();
  }

  private cleanup(key: string): void {
    const entry = this.attempts.get(key);
    if (entry && Date.now() > entry.expiresAt) {
      this.attempts.delete(key);
    }
  }
}
