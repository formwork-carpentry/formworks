/**
 * @module @carpentry/resilience
 * @description Circuit breaker rejection error.
 */

import { ResilienceError } from "./base.js";

/**
 * CircuitBreakerOpenError — thrown when the circuit is open and calls are rejected.
 *
 * Includes `nextAttemptAt` (epoch ms) which indicates when the breaker will transition
 * from `open` → `half-open` to allow probe calls.
 */
export class CircuitBreakerOpenError extends ResilienceError {
  constructor(public readonly nextAttemptAt: number) {
    super("Circuit breaker is open. Request rejected.", "CIRCUIT_BREAKER_OPEN", { nextAttemptAt });
  }
}
