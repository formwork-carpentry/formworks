/**
 * @module @carpentry/core/exceptions
 * @description Base framework exception hierarchy.
 */

import type { Dictionary } from "../types/index.js";

/**
 * Base framework error — all Carpenter exceptions extend this (`code`, `context`).
 *
 * @example
 * ```ts
 * import { CarpenterError } from './';
 * throw new CarpenterError('Something failed', 'MY_CODE', { requestId: 'abc' });
 * ```
 */
export class CarpenterError extends Error {
  public code: string;
  public readonly context: Dictionary;

  /**
   * @param {string} message - Error message
   * @param {string} [code='CARPENTER_ERROR'] - Machine-readable error code
   * @param {Dictionary} [context={}] - Additional context for debugging
   */
  constructor(message: string, code = "CARPENTER_ERROR", context: Dictionary = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
