/**
 * @module @carpentry/resilience
 * @description Resilience patterns — circuit breaker, retry with backoff, and rate limiting.
 *
 * Use this package to:
 * - Fail fast when downstream services are unhealthy (`CircuitBreaker`)
 * - Automatically retry transient failures (`retry`)
 * - Throttle traffic to protect resources (`RateLimiter`)
 *
 * @example
 * ```ts
 * import { CircuitBreaker, retry } from '@carpentry/resilience';
 *
 * const breaker = new CircuitBreaker({ threshold: 3, timeout: 10_000 });
 *
 * const data = await breaker.execute(() =>
 *   retry(() => fetchJson(), { times: 3, backoff: 'exponential', delay: 100 }),
 * );
 * ```
 *
 * @see CircuitBreaker — Circuit breaker execution
 * @see retry — Retry helper with backoff
 * @see RateLimiter — Rate limiting helper
 */

export { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker/CircuitBreaker.js";
export type {
  CircuitBreakerOptions,
  CircuitState,
  CircuitEvent,
} from "./circuit-breaker/CircuitBreaker.js";
export * from "./exceptions/index.js";
export { retry, RateLimiter } from "./retry/Retry.js";
export type { RetryOptions, BackoffStrategy, RateLimiterOptions } from "./retry/Retry.js";
