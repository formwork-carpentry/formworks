/**
 * @module @carpentry/validation
 * @description Validator — validates data against rule strings and returns structured errors.
 *
 * Use {@link Validator} with built-in rules (e.g. `required|email|min:2`) or register custom
 * one-off rules with {@link makeRule}.
 *
 * @patterns Strategy (each rule is a strategy), Chain of Responsibility (rule pipeline per field)
 * @principles OCP — add rules without modifying Validator; SRP — each rule validates one thing
 */

import type {
  IValidationRule,
  IValidator,
  ValidationResult,
  ValidationRules,
} from "@carpentry/formworks/contracts";
import type { Dictionary } from "@carpentry/formworks/core/types";

// ── Built-in Rules ────────────────────────────────────────

const builtInRules: Record<string, IValidationRule> = {
  required: {
    name: "required",
    validate: (_attr, value) => value !== undefined && value !== null && value !== "",
    message: (attr) => `The ${attr} field is required.`,
  },
  string: {
    name: "string",
    validate: (_attr, value) => value === undefined || value === null || typeof value === "string",
    message: (attr) => `The ${attr} field must be a string.`,
  },
  number: {
    name: "number",
    validate: (_attr, value) => value === undefined || value === null || typeof value === "number",
    message: (attr) => `The ${attr} field must be a number.`,
  },
  boolean: {
    name: "boolean",
    validate: (_attr, value) => value === undefined || value === null || typeof value === "boolean",
    message: (attr) => `The ${attr} field must be a boolean.`,
  },
  email: {
    name: "email",
    validate: (_attr, value) => {
      if (value === undefined || value === null || value === "") return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    },
    message: (attr) => `The ${attr} field must be a valid email address.`,
  },
  url: {
    name: "url",
    validate: (_attr, value) => {
      if (value === undefined || value === null || value === "") return true;
      try {
        new URL(String(value));
        return true;
      } catch {
        return false;
      }
    },
    message: (attr) => `The ${attr} field must be a valid URL.`,
  },
  uuid: {
    name: "uuid",
    validate: (_attr, value) => {
      if (value === undefined || value === null || value === "") return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value),
      );
    },
    message: (attr) => `The ${attr} field must be a valid UUID.`,
  },
  min: {
    name: "min",
    validate: (_attr, value, params) => {
      if (value === undefined || value === null) return true;
      const min = Number(params[0]);
      if (typeof value === "string") return value.length >= min;
      if (typeof value === "number") return value >= min;
      if (Array.isArray(value)) return value.length >= min;
      return true;
    },
    message: (attr, params) => `The ${attr} field must be at least ${params[0]}.`,
  },
  max: {
    name: "max",
    validate: (_attr, value, params) => {
      if (value === undefined || value === null) return true;
      const max = Number(params[0]);
      if (typeof value === "string") return value.length <= max;
      if (typeof value === "number") return value <= max;
      if (Array.isArray(value)) return value.length <= max;
      return true;
    },
    message: (attr, params) => `The ${attr} field must not exceed ${params[0]}.`,
  },
  between: {
    name: "between",
    validate: (_attr, value, params) => {
      if (value === undefined || value === null) return true;
      const [lo, hi] = [Number(params[0]), Number(params[1])];
      if (typeof value === "number") return value >= lo && value <= hi;
      if (typeof value === "string") return value.length >= lo && value.length <= hi;
      return true;
    },
    message: (attr, params) => `The ${attr} field must be between ${params[0]} and ${params[1]}.`,
  },
  in: {
    name: "in",
    validate: (_attr, value, params) => {
      if (value === undefined || value === null) return true;
      return params.includes(String(value));
    },
    message: (attr, params) => `The ${attr} field must be one of: ${params.join(", ")}.`,
  },
  nullable: {
    name: "nullable",
    validate: () => true, // Acts as a flag — stops other rules if value is null
    message: () => "",
  },
  confirmed: {
    name: "confirmed",
    validate: (attr, value, _params, data) => {
      return value === data[`${attr}_confirmation`];
    },
    message: (attr) => `The ${attr} confirmation does not match.`,
  },
  array: {
    name: "array",
    validate: (_attr, value) => value === undefined || value === null || Array.isArray(value),
    message: (attr) => `The ${attr} field must be an array.`,
  },
  regex: {
    name: "regex",
    validate: (_attr, value, params) => {
      if (value === undefined || value === null || value === "") return true;
      const pattern = params[0];
      if (pattern === undefined || pattern === "") return false;
      return new RegExp(pattern).test(String(value));
    },
    message: (attr) => `The ${attr} field format is invalid.`,
  },
  date: {
    name: "date",
    validate: (_attr, value) => {
      if (value === undefined || value === null || value === "") return true;
      return !Number.isNaN(new Date(String(value)).getTime());
    },
    message: (attr) => `The ${attr} field must be a valid date.`,
  },
};

// ── Validator ─────────────────────────────────────────────

/**
 * Validate a plain object against a set of rules.
 *
 * Notes:
 * - Rule strings are parsed per field (`field: 'required|string|min:2'`).
 * - Supports dot-notation field keys when accessing nested objects (e.g. `user.email`).
 * - The `nullable` rule short-circuits other rules for `null`/`undefined` values.
 *
 * @example
 * ```ts
 * const validator = new Validator();
 * const result = validator.validate(
 *   { name: 'Alice', age: 13 },
 *   {
 *     name: 'required|string|min:2',
 *     age: 'required|number|min:13',
 *   },
 *   { 'name.min': 'Name is too short.' },
 * );
 *
 * if (!result.passes) {
 *   // { name: ['Name is too short.'], ... }
 *   console.log(result.errors);
 * }
 * ```
 *
 * @see {@link makeRule} — Create one-off rules
 */
export class Validator implements IValidator {
  private customRules = new Map<string, IValidationRule>();

  /** Register a custom validation rule */
  /**
   * Register a custom validation rule that can be referenced by name in rule strings.
   *
   * @param rule - Rule implementing {@link IValidationRule}.
   * @returns {void}
   *
   * @example
   * ```ts
   * const validator = new Validator();
   *
   * validator.addRule(
   *   makeRule(
   *     'uppercase',
   *     (_attr, value) => String(value) === String(value).toUpperCase(),
   *     (attr) => `${attr} must be uppercase.`,
   *   ),
   * );
   * ```
   */
  addRule(rule: IValidationRule): void {
    this.customRules.set(rule.name, rule);
  }

  /** Validate data against rules */
  /**
   * Validate a data object against rules.
   *
   * @param data - Input values to validate.
   * @param rules - Rule definitions per field (rule strings or arrays).
   * @param messages - Optional message overrides:
   *  - Use `field.rule` keys (e.g. `email.required`) for rule-specific messages
   *  - Or use `field` keys (e.g. `email`) as a fallback for that field
   * @returns Structured {@link ValidationResult}.
   *
   * @throws {Error} If a registered or built-in rule returns a Promise (async rules are not supported by `validate()`).
   * @throws {Error} If a referenced rule name is not defined.
   *
   * @remarks
   * Validations are synchronous. For async rules, this package currently expects you to extend
   * validation with a separate async flow (e.g. `validateAsync()` if added later).
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validator evaluates multiple independent rule branches per field
  validate(
    data: Record<string, unknown>,
    rules: ValidationRules,
    messages?: Record<string, string>,
  ): ValidationResult {
    const errors: Record<string, string[]> = {};
    const validated: Record<string, unknown> = {};

    for (const [field, fieldRules] of Object.entries(rules)) {
      const ruleList = this.parseRules(fieldRules);
      const value = this.getValue(data, field);
      const fieldErrors: string[] = [];

      // Check nullable — if nullable rule present and value is null/undefined, skip other rules
      const isNullable = ruleList.some((r) => r.name === "nullable");
      if (isNullable && (value === null || value === undefined)) {
        validated[field] = value;
        continue;
      }

      for (const rule of ruleList) {
        if (rule.name === "nullable") continue;

        const passes = rule.validate(field, value, rule.params ?? [], data);
        if (passes instanceof Promise) {
          throw new Error(
            "Async rules not supported in synchronous validate(). Use validateAsync().",
          );
        }

        if (!passes) {
          const messageKey = `${field}.${rule.name}`;
          const customMessage = messages?.[messageKey] ?? messages?.[field];
          fieldErrors.push(customMessage ?? rule.message(field, rule.params ?? []));
        }
      }

      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      } else {
        validated[field] = value;
      }
    }

    return {
      passes: Object.keys(errors).length === 0,
      errors,
      validated,
    };
  }

  // ── Internal ────────────────────────────────────────────

  private parseRules(rules: string | string[] | IValidationRule[]): ParsedRule[] {
    if (Array.isArray(rules) && rules.length > 0 && typeof rules[0] === "object") {
      return (rules as IValidationRule[]).map((r) => ({ ...r, params: [] }));
    }

    const ruleStrings = typeof rules === "string" ? rules.split("|") : (rules as string[]);

    return ruleStrings.map((ruleStr) => {
      const [rawName, ...paramParts] = ruleStr.split(":");
      const name = rawName?.trim();
      if (!name) {
        throw new Error(`Validation rule "${ruleStr}" is not defined.`);
      }
      const params = paramParts.length > 0 ? paramParts.join(":").split(",") : [];

      const rule = this.customRules.get(name) ?? builtInRules[name];
      if (!rule) {
        throw new Error(`Validation rule "${name}" is not defined.`);
      }

      return { ...rule, params };
    });
  }

  /** Get a value from data using dot-notation (supports nested fields). */
  private getValue(data: Record<string, unknown>, key: string): unknown {
    const parts = key.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Dictionary)[part];
    }

    return current;
  }
}

interface ParsedRule extends IValidationRule {
  params: string[];
}

// ── Helper ────────────────────────────────────────────────

/**
 * Create a one-off custom validation rule from callbacks.
 *
 * @param name - Rule name (used in rule strings, e.g. `'required|myRule'`).
 * @param validateFn - Validation callback. Return `true` to pass.
 * @param messageFn - Error message callback. Receives attribute and params.
 * @returns A rule implementing {@link IValidationRule}.
 *
 * @example
 * ```ts
 * const validator = new Validator();
 *
 * validator.addRule(
 *   makeRule(
 *     'uppercase',
 *     (_attr, value) => String(value) === String(value).toUpperCase(),
 *     (attr) => `${attr} must be uppercase.`,
 *   ),
 * );
 *
 * const result = validator.validate(
 *   { username: 'ALICE' },
 *   { username: 'required|uppercase' },
 * );
 * ```
 *
 * @see {@link Validator} — Register rules with `addRule()`
 * @see {@link IValidationRule} — Rule contract
 */
export function makeRule(
  name: string,
  validateFn: (
    attr: string,
    value: unknown,
    params: string[],
    data: Record<string, unknown>,
  ) => boolean,
  messageFn: (attr: string, params: string[]) => string,
): IValidationRule {
  return { name, validate: validateFn, message: messageFn };
}
