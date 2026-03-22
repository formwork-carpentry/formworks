/**
 * @module @formwork/core/exceptions
 * @description Edge-runtime compatibility exceptions.
 */
import { CarpenterError } from "./base.js";
/**
 * Feature unavailable on edge runtimes (with remediation hint).
 */
export class EdgeIncompatibleError extends CarpenterError {
    constructor(feature, suggestion) {
        super(`Feature "${feature}" is not available on edge runtimes. ${suggestion}`, "EDGE_INCOMPATIBLE", { feature, suggestion });
    }
}
//# sourceMappingURL=edge.js.map