/**
 * @module @formwork/db
 * @description Base error hierarchy for database package failures.
 */

import { CarpenterError } from '@formwork/core/exceptions';

export class DatabaseError extends CarpenterError {
  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    context: Record<string, unknown> = {},
  ) {
    super(message, code, context);
  }
}

export class DatabaseDriverDependencyError extends DatabaseError {
  constructor(driverName: string, message: string) {
    super(message, 'DATABASE_DRIVER_DEPENDENCY_MISSING', { driverName });
  }
}

export class DatabaseOperationError extends DatabaseError {
  constructor(driverName: string, operation: string, message: string) {
    super(message, 'DATABASE_OPERATION_ERROR', { driverName, operation });
  }
}