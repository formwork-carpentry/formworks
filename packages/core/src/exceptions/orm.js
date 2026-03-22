/**
 * @module @formwork/core/exceptions
 * @description ORM-related exceptions.
 */
import { CarpenterError } from "./base.js";
/**
 * ORM-style not found for a model + id.
 */
export class ModelNotFoundError extends CarpenterError {
    constructor(model, id) {
        super(`${model} with ID ${id} not found`, "MODEL_NOT_FOUND", { model, id });
    }
}
//# sourceMappingURL=orm.js.map