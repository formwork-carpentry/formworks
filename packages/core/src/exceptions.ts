/**
 * @module @formwork/core/exceptions
 * @description Framework error hierarchy — CarpenterError, NotFoundError, ValidationError, and more.
 *
 * @example
 * ```ts
 * import { NotFoundError, ValidationError } from '@formwork/core/exceptions';
 *
 * throw new NotFoundError('User not found', { id: userId });
 * throw new ValidationError('Invalid email', { field: 'email', value });
 * ```
 */

export * from "./exceptions/index.js";
