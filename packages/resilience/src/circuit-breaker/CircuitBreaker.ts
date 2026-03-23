/**
 * @module @carpentry/resilience
 * @description Circuit Breaker — State pattern: Closed → Open → HalfOpen → Closed
 * @patterns State (circuit states), Observer (event emission)
 * @principles SRP — circuit management only; OCP — extend via events
 */

import { CircuitBreakerOpenError } from "../exceptions/CircuitBreakerOpenError.js";

export type CircuitState = "closed" | "open" | "half-open";
export type CircuitEvent = "success" | "failure" | "open" | "close" | "half-open";
export type CircuitEventHandler = (event: CircuitEvent, error?: Error) => void;

export interface CircuitBreakerOptions {
  /** Number of failures before opening (default: 5) */
  threshold?: number;
  /** Time in ms before transitioning from Open → HalfOpen (default: 30000) */
  timeout?: number;
  /** Max probe calls in HalfOpen state (default: 1) */
  halfOpenMax?: number;
}

/**
 * CircuitBreaker — wraps async work with failure thresholding.
 *
 * States:
 * - `closed`: normal operation; failures increment a counter
 * - `open`: failures exceeded; calls are rejected until timeout elapses
 * - `half-open`: a limited number of probe calls run; success closes, failure re-opens
 *
 * @example
 * ```ts
 * import { CircuitBreaker } from '@carpentry/resilience';
 *
 * const breaker = new CircuitBreaker({ threshold: 2, timeout: 10_000, halfOpenMax: 1 });
 *
 * for (let i = 0; i < 5; i++) {
 *   try {
 *     await breaker.execute(async () => {
 *       throw new Error('upstream failed');
 *     });
 *   } catch (e) {
 *     // after threshold, e will be CircuitBreakerOpenError until timeout expires
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private threshold: number;
  private timeout: number;
  private halfOpenMax: number;
  private handlers: CircuitEventHandler[] = [];

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.timeout = options.timeout ?? 30000;
    this.halfOpenMax = options.halfOpenMax ?? 1;
  }

  /** Execute a function through the circuit breaker */
  /**
   * @param {(} fn
   * @returns {Promise<T>}
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.transitionTo("half-open");
      } else {
        throw new CircuitBreakerOpenError(this.lastFailureTime + this.timeout);
      }
    }

    if (this.state === "half-open" && this.halfOpenAttempts >= this.halfOpenMax) {
      throw new CircuitBreakerOpenError(this.lastFailureTime + this.timeout);
    }

    try {
      if (this.state === "half-open") {
        this.halfOpenAttempts++;
      }

      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /** Get current circuit state */
  getState(): CircuitState {
    return this.state;
  }

  /** Get current failure count */
  getFailureCount(): number {
    return this.failureCount;
  }

  /** Register event handler */
  /**
   * @param {CircuitEventHandler} handler
   */
  on(handler: CircuitEventHandler): void {
    this.handlers.push(handler);
  }

  /** Reset to closed state (for testing) */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.transitionTo("closed");
    }
    this.failureCount = 0;
    this.emit("success");
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.emit("failure", error);

    if (this.state === "half-open") {
      this.transitionTo("open");
    } else if (this.state === "closed" && this.failureCount >= this.threshold) {
      this.transitionTo("open");
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.emit(newState === "half-open" ? "half-open" : newState === "open" ? "open" : "close");

    if (newState === "closed") {
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
    }
    if (newState === "half-open") {
      this.halfOpenAttempts = 0;
    }
  }

  private emit(event: CircuitEvent, error?: Error): void {
    for (const handler of this.handlers) {
      handler(event, error);
    }
  }
}

export { CircuitBreakerOpenError };
