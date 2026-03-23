/**
 * @module @carpentry/queue
 * @description Base error hierarchy for queue package failures.
 */

import { CarpenterError } from "@carpentry/core/exceptions";

export class QueueError extends CarpenterError {
  constructor(message: string, code = "QUEUE_ERROR", context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export class QueueNotInitializedError extends QueueError {
  constructor() {
    super("QueueManager not initialized.", "QUEUE_NOT_INITIALIZED");
  }
}
