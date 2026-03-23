/**
 * @module @carpentry/core/exceptions
 * @description ORM-related exceptions.
 */

import { CarpenterError } from "./base.js";

/**
 * ORM-style not found for a model + id.
 */
export class ModelNotFoundError extends CarpenterError {
  constructor(model: string, id: string | number) {
    super(`${model} with ID ${id} not found`, "MODEL_NOT_FOUND", { model, id });
  }
}
