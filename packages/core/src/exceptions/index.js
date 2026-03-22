/**
 * @module @formwork/core/exceptions
 * @description Framework exception hierarchy — split by concern, exported through a stable barrel.
 * @patterns Chain of Responsibility (ExceptionHandler)
 * @principles SRP — each file groups one concern; OCP — new exceptions extend base
 */
export * from "./base.js";
export * from "./container.js";
export * from "./http.js";
export * from "./orm.js";
export * from "./service.js";
export * from "./edge.js";
//# sourceMappingURL=index.js.map