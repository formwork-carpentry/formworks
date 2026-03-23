/**
 * @module @carpentry/core/exceptions
 * @description Framework error hierarchy — CarpenterError, NotFoundError, ValidationError, and more.
 *
 * @example
 * ```ts
 * import { NotFoundError, ValidationError } from '@carpentry/core/exceptions';
 *
 * throw new NotFoundError('User not found', { id: userId });
 * throw new ValidationError('Invalid email', { field: 'email', value });
 * ```
 */

export * from "./exceptions/index.js";
