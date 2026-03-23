/**
 * @module @carpentry/resilience
 * @description Base error hierarchy for resilience failures.
 */

import { CarpenterError } from "@carpentry/formworks/core/exceptions";

export class ResilienceError extends CarpenterError {
  constructor(message: string, code = "RESILIENCE_ERROR", context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}
