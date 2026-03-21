/**
 * @module @formwork/core/exceptions
 * @description Container-related exceptions.
 */

import type { Dictionary } from "../types/index.js";
import { CarpenterError } from "./base.js";

/**
 * Container-level failure (registration, resolution, lifecycle).
 */
export class ContainerError extends CarpenterError {
  constructor(message: string, context: Dictionary = {}) {
    super(message, "CONTAINER_ERROR", context);
  }
}

/**
 * Thrown when `Container.make` cannot resolve a token.
 */
export class BindingNotFoundError extends ContainerError {
  /**
   * @param {string | symbol | Function} token - The token that was not found
   */
  // biome-ignore lint/complexity/noBannedTypes: Function type used for token representation
  constructor(token: string | symbol | Function) {
    const tokenName = typeof token === "function" ? token.name : String(token);
    super(`No binding found for token: ${tokenName}`, { token: tokenName });
    this.code = "BINDING_NOT_FOUND";
  }
}

/**
 * Thrown when the dependency graph contains a cycle.
 */
export class CircularDependencyError extends ContainerError {
  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(" → ")}`, { chain });
    this.code = "CIRCULAR_DEPENDENCY";
  }
}
