/**
 * @module @carpentry/padlock/http
 * @description Compatibility barrel for Padlock's HTTP controller and route-registration API.
 * @patterns Facade
 * @principles SRP - keeps the public HTTP entry point stable while implementation lives in focused modules.
 */

export { PadlockController } from "./PadlockController.js";
export type { PadlockControllerOptions } from "./PadlockController.js";
export { registerPadlockRoutes } from "./routes.js";
export type { PadlockRouteOptions, PadlockRouteThrottles } from "./routes.js";
