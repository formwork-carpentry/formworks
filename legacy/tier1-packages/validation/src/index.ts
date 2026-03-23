/**
 * @module @carpentry/validation
 * @description Validator, built-in rules, and custom rule factory helpers.
 *
 * Use this package to validate plain objects (request bodies, DTOs, etc.)
 * using rule strings like `required|email|min:3`, get a structured
 * {@link ValidationResult}, and register custom rules with {@link makeRule}.
 *
 * @example
 * ```ts
 * import { Validator } from '@carpentry/validation';
 *
 * const validator = new Validator();
 * const result = validator.validate(
 *   { name: 'Alice', email: 'alice@example.com' },
 *   { name: 'required|string|min:2', email: 'required|email' },
 * );
 *
 * if (!result.passes) {
 *   console.log(result.errors);
 * }
 * ```
 *
 * @see Validator — Run validation and collect errors
 * @see makeRule — Build one-off custom rules
 */

export { Validator, makeRule } from "./validator/Validator.js";
