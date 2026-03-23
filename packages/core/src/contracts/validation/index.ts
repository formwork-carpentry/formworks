/**
 * @module @carpentry/core/contracts/validation
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

/** @typedef {Object} ValidationResult - Result of validating input */
export interface ValidationResult {
  /** @property {boolean} passes - True if all rules passed */
  passes: boolean;
  /** @property {Record<string, string[]>} errors - Field name to error messages */
  errors: Record<string, string[]>;
  /** @property {Record<string, unknown>} validated - Only the validated fields (safe to use) */
  validated: Record<string, unknown>;
}

/** @typedef {Object} IValidator - Validation engine contract */
export interface IValidator {
  /**
   * Validate input data against rules.
   * @param {Record<string, unknown>} data - Input data to validate
   * @param {Record<string, string>} rules - Validation rules (pipe-separated: 'required|email|max:255')
   * @returns {ValidationResult} Validation result with passes, errors, and validated data
   * @example
   * ```ts
   * const result = validator.validate(req.body(), {
   *   title: 'required|string|min:3|max:200',
   *   email: 'required|email',
   *   age: 'required|number|min:18',
   * });
   * ```
   */
  validate(
    data: Record<string, unknown>,
    rules: ValidationRules,
    messages?: Record<string, string>,
  ): ValidationResult;
}

/** @typedef {Record<string, string>} ValidationRules - Map of field name to validation rules */
export type ValidationRules = Record<string, string | string[] | IValidationRule[]>;

/** @typedef {Object} IValidationRule - Custom validation rule contract */
export interface IValidationRule {
  name: string;

  /**
   * Validate a single field value.
   * @param {string} field - Field name
   * @param {unknown} value - Field value
   * @param {string[]} params - Rule parameters (e.g., ['8'] for 'min:8')
   * @param {Record<string, unknown>} data - Full input data (for cross-field rules)
   * @returns {boolean} True if the value passes the rule
   */
  validate(
    field: string,
    value: unknown,
    params: string[],
    data: Record<string, unknown>,
  ): boolean | Promise<boolean>;

  /**
   * Get the error message when validation fails.
   * @param {string} field - Field name
   * @param {string[]} params - Rule parameters
   * @returns {string} Error message
   */
  message(field: string, params: string[]): string;
}
