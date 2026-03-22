/**
 * @module @formwork/core
 * @description Foundational types used across all framework contracts
 * @patterns None (pure type definitions)
 * @principles ISP — types split by concern; DIP — abstract tokens for DI
 */
/** Create a success result */
/**
 * @param {T} value
 * @returns {Ok<T>}
 */
export function ok(value) {
    return { ok: true, value };
}
/** Create an error result */
/**
 * @param {E} error
 * @returns {Err<E>}
 */
export function err(error) {
    return { ok: false, err: error };
}
//# sourceMappingURL=index.js.map