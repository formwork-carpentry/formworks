/**
 * @module @formwork/core/contracts/http
 * @description HTTP contracts - request, response, routing, and middleware interfaces.
 *
 * Implementations: Request, CarpenterResponse, Router, HttpKernel, Pipeline
 *
 * @example
 * ```ts
 * router.get('/api/users/:id', async (req: IRequest) => {
 *   const id = req.param('id');
 *   return CarpenterResponse.json({ data: await User.findOrFail(id) });
 * });
 * ```
 */

import type { MaybeAsync, Token } from "../../types/index.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/** @typedef {new (...args: unknown[]) => unknown} HttpConstructor */
export type HttpConstructor = new (...args: unknown[]) => unknown;

export interface CookieOptions {
  maxAge?: number;
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
}

/**
 * HTTP Request interface.
 * @typedef {Object} IRequest
 */
export interface IRequest {
  /**
   * Get the HTTP method (GET, POST, PUT, PATCH, DELETE).
   * @returns {string} Uppercase HTTP method
   */
  method(): string;

  /**
   * Get the request path.
   * @returns {string} URL path (e.g., '/api/users/42')
   */
  path(): string;

  /**
   * Get a route parameter by name.
   * @param {string} name - Parameter name from route pattern (e.g., 'id' from '/users/:id')
   * @returns {string} Parameter value
   */
  param(name: string): string | undefined;

  /**
   * Get a query string parameter.
   * @param {string} name - Query parameter name
   * @returns {string | null} Parameter value or null
   * @example
   * ```ts
   * // GET /api/posts?status=published&page=2
   * req.query('status'); // 'published'
   * req.query('page');   // '2'
   * ```
   */
  query(name: string): string | undefined;

  /**
   * Get a request header value.
   * @param {string} name - Header name (case-insensitive)
   * @returns {string | undefined} Header value
   */
  header(name: string): string | undefined;

  /**
   * Get the parsed request body.
   * @returns {T} Parsed body (JSON object, form data, etc.)
   */
  body<T = unknown>(): T;

  /**
   * Get all input data (merged query + body).
   * @returns {Record<string, unknown>}
   */
  all(): Record<string, unknown>;

  /**
   * Get a specific input value by key (checks body first, then query).
   * @param {string} key - Input key
   * @param {T} [fallback] - Default value if key not found
   * @returns {T | undefined}
   */
  input<T = unknown>(key: string, fallback?: T): T | undefined;

  /**
   * Check if the request expects JSON.
   * @returns {boolean}
   */
  wantsJson(): boolean;
}

/**
 * HTTP Response interface.
 * @typedef {Object} IResponse
 */
export interface IResponse {
  /**
   * Get the HTTP status code.
   * @returns {number}
   */
  getStatusCode(): number;

  /**
   * Get all response headers.
   * @returns {Record<string, string>}
   */
  getHeaders(): Record<string, string>;

  /**
   * Get the response body.
   * @returns {string | Buffer}
   */
  getBody(): unknown;

  /**
   * Set a response header.
   * @param {string} name - Header name
   * @param {string} value - Header value
   * @returns {IResponse} Fluent interface
   */
  header(name: string, value: string): IResponse;
}

/**
 * Route handler - either a controller method pair or an inline function.
 * @typedef {Function | [HttpConstructor, string]} RouteHandler
 *
 * @example
 * ```ts
 * // Inline handler:
 * router.get('/health', async (req) => CarpenterResponse.json({ ok: true }));
 *
 * // Controller method:
 * router.get('/users', [UserController, 'index']);
 * ```
 */
export type RouteHandler =
  | [HttpConstructor, string]
  | ((req: IRequest, ...args: unknown[]) => MaybeAsync<IResponse | unknown>);

export type NextFunction = () => Promise<IResponse>;

export interface IMiddleware {
  handle(request: IRequest, next: NextFunction): MaybeAsync<IResponse>;
}

/**
 * Middleware function signature.
 * @typedef {Function} MiddlewareFunction
 * @param {IRequest} request - The incoming request
 * @param {Function} next - Call to pass to the next middleware
 * @returns {Promise<IResponse>}
 */
export type MiddlewareFunction = (
  request: IRequest,
  next: (req: IRequest) => Promise<IResponse>,
) => Promise<IResponse>;

/** @typedef {Object} IRouteRegistrar - Route registration interface */
export interface IRouteRegistrar {
  /** @returns {IRouteRegistrar} Fluent interface */
  name(routeName: string): IRouteRegistrar;
  /** @returns {IRouteRegistrar} Fluent interface */
  middleware(...mw: (MiddlewareFunction | Token | string)[]): IRouteRegistrar;
}

/** @typedef {Object} RouteDefinition */
export interface RouteDefinition {
  /** @property {string} method - HTTP method */
  method: string;
  /** @property {string} path - URL pattern */
  path: string;
  /** @property {RouteHandler} handler - Request handler */
  handler: RouteHandler;
  /** @property {MiddlewareFunction[]} middleware - Route middleware */
  middleware: MiddlewareFunction[];
  /** @property {string} [routeName] - Named route identifier */
  routeName?: string;
}

export interface IRoute {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  name?: string;
  middleware: (Token | string)[];
}

export interface ResolvedRoute {
  route: IRoute;
  params: Record<string, string>;
}

export interface RouteGroupOptions {
  prefix?: string;
  middleware?: (Token | string)[];
}

/** @typedef {Object} IRouter - Router interface */
export interface IRouter {
  /**
   * Register a GET route.
   * @param {string} path - URL pattern (e.g., '/api/users/:id')
   * @param {RouteHandler} handler - Request handler
   * @returns {IRouteRegistrar}
   */
  get(path: string, handler: RouteHandler): IRouteRegistrar;
  /**
   * Register a POST route.
   * @param {string} path - URL pattern
   * @param {RouteHandler} handler - Request handler
   * @returns {IRouteRegistrar}
   */
  post(path: string, handler: RouteHandler): IRouteRegistrar;
  /**
   * Register a PUT route.
   * @param {string} path - URL pattern
   * @param {RouteHandler} handler - Request handler
   * @returns {IRouteRegistrar}
   */
  put(path: string, handler: RouteHandler): IRouteRegistrar;
  /**
   * Register a PATCH route.
   * @param {string} path - URL pattern
   * @param {RouteHandler} handler - Request handler
   * @returns {IRouteRegistrar}
   */
  patch(path: string, handler: RouteHandler): IRouteRegistrar;
  /**
   * Register a DELETE route.
   * @param {string} path - URL pattern
   * @param {RouteHandler} handler - Request handler
   * @returns {IRouteRegistrar}
   */
  delete(path: string, handler: RouteHandler): IRouteRegistrar;

  resolve(method: HttpMethod, path: string): ResolvedRoute | null;
}

export interface IHttpKernel {
  handle(request: IRequest): Promise<IResponse>;
  terminate(request: IRequest, response: IResponse): Promise<void>;
  onError(renderer: (error: Error, request: IRequest) => IResponse | null): void;
}
