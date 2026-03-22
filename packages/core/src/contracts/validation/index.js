/**
 * @module @formwork/core/contracts/validation
 * @description Validation contract - input validation interface.
 *
 * Implementations: Validator
 *
 * @example
 * ```ts
 * const validator = container.make<IValidator>('validator');
 * const result = validator.validate(input, { email: 'required|email', name: 'required|min:2' });
 * if (!result.passes) return { errors: result.errors };
 * ```
 */
export {};
//# sourceMappingURL=index.js.map