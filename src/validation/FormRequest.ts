/**
 * @module @carpentry/validation
 * @description FormRequest — combines authorization + validation for incoming requests
 * @patterns Template Method (authorize/rules defined by subclass)
 * @principles SRP (request validation), DIP (depends on Validator interface)
 */

import type { ValidationResult, ValidationRules } from "../contracts";
import { Validator } from "./validator/Validator.js";

/**
 * Base class for form request validation.
 * Subclass and define `rules()` and optionally `authorize()` + `messages()`.
 *
 * @example
 * ```ts
 * class StoreUserRequest extends FormRequest {
 *   rules(): ValidationRules {
 *     return {
 *       name: 'required|string|min:2',
 *       email: 'required|email',
 *       age: 'required|number|min:13',
 *     };
 *   }
 *
 *   authorize(): boolean {
 *     return this.user?.role === 'admin';
 *   }
 * }
 * ```
 */
export abstract class FormRequest {
  /** The data to validate (set via setData or constructor) */
  protected data: Record<string, unknown> = {};

  /** Optional user context for authorization */
  protected user: Record<string, unknown> | null = null;

  /**
   * Define the validation rules for this request.
   * @returns {ValidationRules} Rules in 'required|string|min:3' format
   */
  abstract rules(): ValidationRules;

  /**
   * Determine if the user is authorized to make this request.
   * Override in subclass to add authorization logic.
   * @returns {boolean} True if authorized (default: true)
   */
  authorize(): boolean {
    return true;
  }

  /**
   * Custom error messages for validation rules.
   * @returns {Record<string, string>} Keys are 'field.rule' format (e.g., 'name.required')
   */
  messages(): Record<string, string> {
    return {};
  }

  /**
   * Set the data to validate.
   * @param {Record<string, unknown>} data - Input data
   * @returns {this} Fluent interface
   */
  setData(data: Record<string, unknown>): this {
    this.data = data;
    return this;
  }

  /**
   * Set the user context for authorization.
   * @param {Record<string, unknown> | null} user - User context
   * @returns {this} Fluent interface
   */
  setUser(user: Record<string, unknown> | null): this {
    this.user = user;
    return this;
  }

  /**
   * Validate the request. Checks authorization first, then validates data.
   * @returns {ValidationResult & { authorized: boolean }} Result with passes, errors, validated data
   * @throws {Error} If authorization fails (code: 'UNAUTHORIZED')
   */
  validate(): ValidationResult & { authorized: boolean } {
    if (!this.authorize()) {
      return {
        passes: false,
        authorized: false,
        errors: { _authorization: ["This action is unauthorized."] },
        validated: {},
      };
    }

    const validator = new Validator();
    const result = validator.validate(this.data, this.rules(), this.messages());

    return {
      ...result,
      authorized: true,
    };
  }

  /**
   * Validate and return only the validated data.
   * @returns {Record<string, unknown>} Validated and sanitized data
   * @throws {Error} If authorization fails (code: 'UNAUTHORIZED', status: 403)
   * @throws {Error} If validation fails (code: 'VALIDATION_ERROR', status: 422)
   */
  validated(): Record<string, unknown> {
    const result = this.validate();
    if (!result.authorized) {
      throw Object.assign(new Error("This action is unauthorized."), {
        code: "UNAUTHORIZED",
        status: 403,
      });
    }
    if (!result.passes) {
      throw Object.assign(new Error("Validation failed."), {
        code: "VALIDATION_ERROR",
        status: 422,
        errors: result.errors,
      });
    }
    return result.validated;
  }
}
