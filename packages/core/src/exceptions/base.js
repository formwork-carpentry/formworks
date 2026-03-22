/**
 * @module @formwork/core/exceptions
 * @description Base framework exception hierarchy.
 */
/**
 * Base framework error — all Carpenter exceptions extend this (`code`, `context`).
 *
 * @example
 * ```ts
 * import { CarpenterError } from '@formwork/core/exceptions';
 * throw new CarpenterError('Something failed', 'MY_CODE', { requestId: 'abc' });
 * ```
 */
export class CarpenterError extends Error {
    code;
    context;
    /**
     * @param {string} message - Error message
     * @param {string} [code='CARPENTER_ERROR'] - Machine-readable error code
     * @param {Dictionary} [context={}] - Additional context for debugging
     */
    constructor(message, code = "CARPENTER_ERROR", context = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.context = context;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
//# sourceMappingURL=base.js.map