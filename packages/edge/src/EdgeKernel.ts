/**
 * @module @formwork/edge
 * @description EdgeKernel — a lightweight, zero-dependency HTTP kernel designed for edge runtimes
 * (Cloudflare Workers, Deno Deploy, Vercel Edge, Fastly Compute).
 *
 * WHY: The main HttpKernel depends on IoC Container + reflect-metadata + node:fs — all
 * unavailable or expensive on edge runtimes. EdgeKernel provides the same routing +
 * middleware pipeline pattern with zero dependencies beyond the Web Standards API
 * (Request, Response, URL, Headers).
 *
 * HOW: Register routes with get/post/put/delete, add middleware with use(),
 * then pass a Web Standard Request to handle() → get a Web Standard Response back.
 * Middleware follows the same next() pattern as the main framework.
 *
 * @patterns Template Method (request lifecycle), Chain of Responsibility (middleware pipeline)
 * @principles SRP (edge HTTP handling only), LSP (substitutable for HttpKernel in edge contexts)
 *
 * @example
 * ```ts
 * // Cloudflare Workers
 * import { EdgeKernel, edgeJson, edgeCors } from '@formwork/edge';
 *
 * const kernel = new EdgeKernel();
 * kernel.use(edgeCors({ origin: 'https://myapp.com' }));
 * kernel.get('/api/users/:id', async (req) => {
 *   return edgeJson({ id: req.params['id'], name: 'Alice' });
 * });
 *
 * export default { fetch: (req: Request) => kernel.handle(req) };
 * ```
 */

// ── Types ─────────────────────────────────────────────────

/**
 * Edge middleware function. Receives the request and a `next` function
 * to pass control to the next middleware or the route handler.
 *
 * @example
 * ```ts
 * const timing: EdgeMiddleware = async (req, next) => {
 *   const start = Date.now();
 *   const res = await next(req);
 *   res.headers['x-response-time'] = `${Date.now() - start}ms`;
 *   return res;
 * };
 * ```
 */
export type EdgeMiddleware = (
  request: EdgeRequest,
  next: (req: EdgeRequest) => Promise<EdgeResponse>,
) => Promise<EdgeResponse>;

/** Route handler — receives a parsed request, returns a response */
export type EdgeHandler = (request: EdgeRequest) => Promise<EdgeResponse>;

/** Internal route definition with compiled regex for matching */
export interface EdgeRoute {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: EdgeHandler;
  middleware: EdgeMiddleware[];
}

/**
 * Parsed edge request — a simplified, edge-friendly request object.
 * Unlike the main framework's Request class, this has no dependency on
 * reflect-metadata or node APIs.
 */
export interface EdgeRequest {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Full URL string */
  url: string;
  /** URL path only (e.g., '/api/users/42') */
  path: string;
  /** Request headers as a plain object */
  headers: Record<string, string>;
  /** Route parameters extracted from URL pattern (e.g., { id: '42' }) */
  params: Record<string, string>;
  /** Query string parameters */
  query: Record<string, string>;
  /** Parsed request body (JSON or text, null for GET/HEAD) */
  body: unknown;
  /** The original Web Standard Request (for advanced use cases) */
  raw: Request;
}

/** Edge response — a simple object that gets converted to a Web Standard Response */
export interface EdgeResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

// ── Edge Kernel ───────────────────────────────────────────

/**
 * Lightweight HTTP kernel for edge runtimes.
 *
 * Unlike the main HttpKernel, EdgeKernel has:
 * - No IoC container dependency
 * - No reflect-metadata requirement
 * - No node:fs or node:crypto imports
 * - No service providers or config system
 *
 * It DOES provide:
 * - Express-style route registration with parameter extraction
 * - Middleware pipeline (global + per-route)
 * - Automatic JSON body parsing
 * - Error catching with 500 responses
 * - CORS middleware helper
 *
 * @example
 * ```ts
 * const kernel = new EdgeKernel();
 *
 * // Global middleware runs on every request
 * kernel.use(async (req, next) => {
 *   console.log(`${req.method} ${req.path}`);
 *   return next(req);
 * });
 *
 * // Route handlers
 * kernel.get('/health', async () => edgeJson({ status: 'ok' }));
 * kernel.post('/api/items', async (req) => {
 *   const item = req.body as { name: string };
 *   return edgeJson({ created: item }, 201);
 * });
 *
 * // In Deno:
 * Deno.serve((req) => kernel.handle(req));
 * ```
 */
export class EdgeKernel {
  /** Registered routes, matched in order */
  private routes: EdgeRoute[] = [];

  /** Global middleware applied to every request before route middleware */
  private globalMiddleware: EdgeMiddleware[] = [];

  /** Custom 404 handler (replaceable via onNotFound) */
  private notFoundHandler: EdgeHandler = async () => ({
    status: 404,
    headers: { "content-type": "application/json" },
    body: { error: "Not Found" },
  });

  // ── Route Registration ──────────────────────────────────
  // Each method is a shorthand for route(METHOD, path, handler).
  // Routes are matched in registration order — first match wins.

  /** Add global middleware (runs on every request, in order) */
  /**
   * @param {EdgeMiddleware} middleware
   * @returns {this}
   */
  use(middleware: EdgeMiddleware): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Register a GET route.
   * @param path - URL pattern with optional :params (e.g., '/users/:id')
   * @param handler - Async function that returns an EdgeResponse
   * @param middleware - Optional route-specific middleware
   */
  get(path: string, handler: EdgeHandler, ...middleware: EdgeMiddleware[]): this {
    return this.route("GET", path, handler, middleware);
  }

  /** Register a POST route */
  /**
   * @param {string} path
   * @param {EdgeHandler} handler
   * @param {EdgeMiddleware[]} ...middleware
   * @returns {this}
   */
  post(path: string, handler: EdgeHandler, ...middleware: EdgeMiddleware[]): this {
    return this.route("POST", path, handler, middleware);
  }

  /** Register a PUT route */
  /**
   * @param {string} path
   * @param {EdgeHandler} handler
   * @param {EdgeMiddleware[]} ...middleware
   * @returns {this}
   */
  put(path: string, handler: EdgeHandler, ...middleware: EdgeMiddleware[]): this {
    return this.route("PUT", path, handler, middleware);
  }

  /** Register a DELETE route */
  /**
   * @param {string} path
   * @param {EdgeHandler} handler
   * @param {EdgeMiddleware[]} ...middleware
   * @returns {this}
   */
  delete(path: string, handler: EdgeHandler, ...middleware: EdgeMiddleware[]): this {
    return this.route("DELETE", path, handler, middleware);
  }

  /**
   * Register a route with any HTTP method.
   * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
   * @param path - URL pattern (e.g., '/api/posts/:id/comments')
   * @param handler - Request handler function
   * @param middleware - Route-specific middleware (runs after global middleware)
   */
  route(
    method: string,
    path: string,
    handler: EdgeHandler,
    middleware: EdgeMiddleware[] = [],
  ): this {
    const { pattern, paramNames } = this.compilePath(path);
    this.routes.push({ method: method.toUpperCase(), pattern, paramNames, handler, middleware });
    return this;
  }

  /** Replace the default 404 handler */
  /**
   * @param {EdgeHandler} handler
   * @returns {this}
   */
  onNotFound(handler: EdgeHandler): this {
    this.notFoundHandler = handler;
    return this;
  }

  // ── Request Handling ────────────────────────────────────

  /**
   * Handle a Web Standard Request and return a Web Standard Response.
   * This is the entry point for edge runtimes.
   *
   * Lifecycle:
   * 1. Parse the raw Request into an EdgeRequest
   * 2. Match against registered routes
   * 3. Run global middleware → route middleware → handler
   * 4. Convert EdgeResponse to Web Standard Response
   * 5. On error: return 500 with error message
   *
   * @param raw - A Web Standard Request object
   * @returns A Web Standard Response object
   *
   * @example
   * ```ts
   * // Cloudflare Workers entry point
   * export default { fetch: (req: Request) => kernel.handle(req) };
   * ```
   */
  async handle(raw: Request): Promise<Response> {
    const edgeReq = await this.parseRequest(raw);
    const matched = this.matchRoute(edgeReq);

    let edgeRes: EdgeResponse;
    if (matched) {
      edgeReq.params = matched.params;
      // Combine global + route-specific middleware
      const allMiddleware = [...this.globalMiddleware, ...matched.route.middleware];
      edgeRes = await this.runPipeline(edgeReq, allMiddleware, matched.route.handler);
    } else {
      // No route matched — run global middleware then 404 handler
      edgeRes = await this.runPipeline(edgeReq, this.globalMiddleware, this.notFoundHandler);
    }

    return this.toResponse(edgeRes);
  }

  /** Get the number of registered routes (useful for debugging/testing) */
  getRouteCount(): number {
    return this.routes.length;
  }

  // ── Internal: Request Parsing ───────────────────────────

  /**
   * Parse a Web Standard Request into our simplified EdgeRequest.
   * Extracts: method, path, headers, query params, and body (JSON or text).
   */
  private async parseRequest(raw: Request): Promise<EdgeRequest> {
    const url = new URL(raw.url);

    // Convert Headers iterator to plain object
    const headers: Record<string, string> = {};
    raw.headers.forEach((v, k) => {
      headers[k] = v;
    });

    // Convert URLSearchParams to plain object
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });

    // Parse body for non-GET/HEAD requests
    let body: unknown = null;
    if (raw.method !== "GET" && raw.method !== "HEAD") {
      const ct = raw.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        try {
          body = await raw.json();
        } catch {
          body = null;
        }
      } else {
        try {
          body = await raw.text();
        } catch {
          body = null;
        }
      }
    }

    return {
      method: raw.method,
      url: raw.url,
      path: url.pathname,
      headers,
      params: {},
      query,
      body,
      raw,
    };
  }

  // ── Internal: Route Matching ────────────────────────────

  /**
   * Find the first route that matches the request method and path.
   * Returns null if no route matches (→ 404).
   */
  private matchRoute(
    req: EdgeRequest,
  ): { route: EdgeRoute; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(req.path);
      if (match) {
        // Extract named parameters from regex capture groups
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        return { route, params };
      }
    }
    return null;
  }

  // ── Internal: Middleware Pipeline ────────────────────────

  /**
   * Execute the middleware chain, then the handler.
   * Each middleware calls next() to pass to the next one.
   * If any middleware or handler throws, we catch it and return 500.
   */
  private async runPipeline(
    req: EdgeRequest,
    middleware: EdgeMiddleware[],
    handler: EdgeHandler,
  ): Promise<EdgeResponse> {
    let idx = 0;
    const next = async (r: EdgeRequest): Promise<EdgeResponse> => {
      if (idx < middleware.length) {
        const mw = middleware[idx++];
        return mw(r, next);
      }
      return handler(r);
    };
    try {
      return await next(req);
    } catch (error) {
      // Catch-all error handler — prevents unhandled rejections in edge runtimes
      return {
        status: 500,
        headers: { "content-type": "application/json" },
        body: { error: (error as Error).message },
      };
    }
  }

  // ── Internal: Path Compilation ──────────────────────────

  /**
   * Compile a route path pattern into a regex.
   * Segments starting with ':' become named capture groups.
   *
   * Examples:
   *   '/users/:id'              → /^\/users\/([^/]+)$/
   *   '/posts/:postId/comments' → /^\/posts\/([^/]+)\/comments$/
   */
  private compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const regexStr = path
      .split("/")
      .filter(Boolean)
      .map((seg) => {
        if (seg.startsWith(":")) {
          paramNames.push(seg.slice(1));
          return "/([^/]+)";
        }
        return `/${seg}`;
      })
      .join("");
    return { pattern: new RegExp(`^${regexStr || "/"}$`), paramNames };
  }

  // ── Internal: Response Conversion ───────────────────────

  /**
   * Convert our EdgeResponse to a Web Standard Response.
   * Handles special cases: 204/304 must not have a body per HTTP spec.
   */
  private toResponse(edgeRes: EdgeResponse): Response {
    // 204 No Content and 304 Not Modified must not include a body
    if (edgeRes.status === 204 || edgeRes.status === 304) {
      return new Response(null, { status: edgeRes.status, headers: edgeRes.headers });
    }
    const body = typeof edgeRes.body === "string" ? edgeRes.body : JSON.stringify(edgeRes.body);
    const headers = { ...edgeRes.headers };
    if (!headers["content-type"]) headers["content-type"] = "application/json";
    return new Response(body, { status: edgeRes.status, headers });
  }
}

// ── Response Helpers ──────────────────────────────────────
// Convenience functions for common response patterns.
// These are pure functions (no side effects) — safe to use anywhere.

/**
 * Create a JSON response.
 *
 * @param data - Any serializable value (object, array, primitive)
 * @param status - HTTP status code (default: 200)
 * @param headers - Additional response headers
 *
 * @example
 * ```ts
 * kernel.get('/api/users', async () => edgeJson({ users: [] }));
 * kernel.post('/api/users', async (req) => edgeJson({ created: req.body }, 201));
 * ```
 */
export function edgeJson(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): EdgeResponse {
  return { status, headers: { "content-type": "application/json", ...headers }, body: data };
}

/**
 * Create a plain text response.
 *
 * @example
 * ```ts
 * kernel.get('/robots.txt', async () => edgeText('User-agent: *\nDisallow: /admin'));
 * ```
 */
export function edgeText(text: string, status = 200): EdgeResponse {
  return { status, headers: { "content-type": "text/plain" }, body: text };
}

/**
 * Create a redirect response.
 *
 * @param url - Target URL to redirect to
 * @param status - HTTP status (302 temporary by default, use 301 for permanent)
 *
 * @example
 * ```ts
 * kernel.get('/old-page', async () => edgeRedirect('/new-page', 301));
 * ```
 */
export function edgeRedirect(url: string, status = 302): EdgeResponse {
  return { status, headers: { location: url }, body: null };
}

/**
 * CORS middleware for edge runtimes.
 *
 * Handles preflight OPTIONS requests automatically and adds
 * Access-Control-Allow-Origin to all responses.
 *
 * WHY: Edge functions often serve APIs consumed by browser apps on
 * different origins. Without CORS headers, browsers block the responses.
 *
 * @param options - origin (default: '*'), methods (default: common REST methods)
 *
 * @example
 * ```ts
 * // Allow all origins (development)
 * kernel.use(edgeCors());
 *
 * // Restrict to specific origin (production)
 * kernel.use(edgeCors({ origin: 'https://myapp.com' }));
 * ```
 */
export function edgeCors(options: { origin?: string; methods?: string[] } = {}): EdgeMiddleware {
  const origin = options.origin ?? "*";
  const methods = (options.methods ?? ["GET", "POST", "PUT", "DELETE", "OPTIONS"]).join(", ");

  return async (req, next) => {
    // Preflight requests get an immediate 204 response with CORS headers
    if (req.method === "OPTIONS") {
      return {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": methods,
          "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
          "access-control-max-age": "86400", // Cache preflight for 24 hours
        },
        body: null,
      };
    }

    // Normal requests — add CORS origin header to the response
    const res = await next(req);
    res.headers["access-control-allow-origin"] = origin;
    return res;
  };
}
