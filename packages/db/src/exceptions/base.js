/**
 * @module @formwork/db
 * @description Base error hierarchy for database package failures.
 */
import { CarpenterError } from '@formwork/core/exceptions';
export class DatabaseError extends CarpenterError {
    constructor(message, code = 'DATABASE_ERROR', context = {}) {
        super(message, code, context);
    }
}
export class DatabaseDriverDependencyError extends DatabaseError {
    constructor(driverName, message) {
        super(message, 'DATABASE_DRIVER_DEPENDENCY_MISSING', { driverName });
    }
}
export class DatabaseOperationError extends DatabaseError {
    constructor(driverName, operation, message) {
        super(message, 'DATABASE_OPERATION_ERROR', { driverName, operation });
    }
}
//# sourceMappingURL=base.js.map