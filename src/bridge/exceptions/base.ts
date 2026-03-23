/**
 * @module @carpentry/bridge
 * @description Base error hierarchy for bridge package failures.
 */

import { CarpenterError } from "@carpentry/formworks/core/exceptions";

export class BridgeError extends CarpenterError {
  constructor(message: string, code = "BRIDGE_ERROR", context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}
