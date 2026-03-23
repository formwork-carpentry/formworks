/**
 * @module @carpentry/storage
 * @description Base error hierarchy for storage package failures.
 */

import { CarpenterError } from "@carpentry/formworks/core/exceptions";

export class StorageError extends CarpenterError {
  constructor(message: string, code = "STORAGE_ERROR", context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export class StorageNotInitializedError extends StorageError {
  constructor() {
    super("StorageManager not initialized.", "STORAGE_NOT_INITIALIZED");
  }
}

export class StorageFileNotFoundError extends StorageError {
  constructor(path: string) {
    super(`File not found: ${path}`, "STORAGE_FILE_NOT_FOUND", { path });
  }
}

export class StorageOperationError extends StorageError {
  constructor(operation: string, message: string, context: Record<string, unknown> = {}) {
    super(message, "STORAGE_OPERATION_ERROR", { operation, ...context });
  }
}
