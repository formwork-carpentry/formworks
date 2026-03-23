/**
 * @module @carpentry/http
 * @description HTTP layer — kernel, routing, request/response, middleware pipeline, and controllers.
 *
 * Use this package to:
 * - Define routes with {@link Router}
 * - Execute routing with {@link HttpKernel}
 * - Build responses with {@link CarpenterResponse} / {@link response}
 * - Add cross-cutting middleware (CORS, rate limiting, secure headers)
 *
 * @example
 * ```ts
 * import { Router, HttpKernel, CarpenterResponse } from '@carpentry/http';
 *
 * const router = new Router();
 * router.get('/health', () => CarpenterResponse.json({ status: 'ok' }));
 *
 * const kernel = new HttpKernel(container, router, { debug: true });
 * const res = await kernel.handle(request);
 * ```
 *
 * @see Router — Define routes
 * @see HttpKernel — Run request/route handling
 * @see CarpenterResponse — JSON/redirect/raw response helpers
 */

export { Request } from "./request/Request.js";
export { CarpenterResponse, ViewResponse, response } from "./response/Response.js";
export { Pipeline } from "./middleware/Pipeline.js";
export type { MiddlewareEntry, MiddlewareFunction } from "./middleware/Pipeline.js";
export { Router } from "./router/Router.js";
export {
	buildRouteGauger,
	defineRouteGaugerReference,
	generateRouteGaugerFiles,
} from "./router/route-gauger.js";
export type {
	RouteGaugerFile,
	RouteGaugerEntry,
	RouteParams,
	RouteGaugerReference,
} from "./router/route-gauger.js";
export { HttpKernel } from "./kernel/HttpKernel.js";
export type { HttpKernelOptions } from "./kernel/HttpKernel.js";
export { ExceptionHandler } from "./kernel/ExceptionHandler.js";
export { BaseController } from "./controller/BaseController.js";
export { CorsMiddleware } from "./middleware/CorsMiddleware.js";
export type { CorsOptions } from "./middleware/CorsMiddleware.js";
export { RateLimitMiddleware } from "./middleware/RateLimitMiddleware.js";
export type { RateLimitOptions } from "./middleware/RateLimitMiddleware.js";

export { Profiler, ProfileCollector } from "./middleware/Profiler.js";
export type { RequestProfile, ProfileEvent } from "./middleware/Profiler.js";

export { serve } from "./server/Server.js";
export type { ServeOptions } from "./server/Server.js";

export { serveHttp3, checkHttp3Support } from "./server/Http3.js";
export type { Http3Options } from "./server/Http3.js";
