/**
 * @module @carpentry/http
 * @description CORS middleware — handles preflight OPTIONS and sets Access-Control-* headers
 * @patterns Strategy (configurable origin/methods/headers)
 * @principles SRP (CORS only), OCP (configurable via options)
 */

import type { Request } from "../request/Request.js";
import { CarpenterResponse } from "../response/Response.js";

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULTS: Required<CorsOptions> = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400,
};

/**
 * CorsMiddleware — handles CORS headers and preflight OPTIONS requests.
 *
 * Adds `Access-Control-Allow-*` headers based on the provided {@link CorsOptions}.
 *
 * @example
 * ```ts
 * const cors = new CorsMiddleware({ origin: '*', credentials: false });
 * // When used in the pipeline, preflight OPTIONS is answered automatically.
 * ```
 */
export class CorsMiddleware {
  private options: Required<CorsOptions>;
  constructor(options: CorsOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /**
   * @param {Request} request
   * @param {(} next
   * @returns {CarpenterResponse | Promise<CarpenterResponse>}
   */
  handle(
    request: Request,
    next: () => CarpenterResponse | Promise<CarpenterResponse>,
  ): CarpenterResponse | Promise<CarpenterResponse> {
    const origin = request.header("origin") ?? "";
    if (request.method() === "OPTIONS") return this.preflight(origin);
    const responseOrPromise = next();
    if (responseOrPromise instanceof Promise)
      return responseOrPromise.then((res) => this.addHeaders(res, origin));
    return this.addHeaders(responseOrPromise, origin);
  }

  private preflight(origin: string): CarpenterResponse {
    const res = CarpenterResponse.json("", 204);
    this.setCorsHeaders(res, origin);
    res.header("Access-Control-Max-Age", String(this.options.maxAge));
    return res;
  }

  private addHeaders(response: CarpenterResponse, origin: string): CarpenterResponse {
    this.setCorsHeaders(response, origin);
    return response;
  }

  private setCorsHeaders(response: CarpenterResponse, origin: string): void {
    const allowedOrigin = this.resolveOrigin(origin);
    response.header("Access-Control-Allow-Origin", allowedOrigin);
    response.header("Access-Control-Allow-Methods", this.options.methods.join(", "));
    response.header("Access-Control-Allow-Headers", this.options.allowedHeaders.join(", "));
    if (this.options.exposedHeaders.length > 0) {
      response.header("Access-Control-Expose-Headers", this.options.exposedHeaders.join(", "));
    }
    if (this.options.credentials) {
      response.header("Access-Control-Allow-Credentials", "true");
    }
  }

  private resolveOrigin(requestOrigin: string): string {
    const opt = this.options.origin;
    if (opt === "*") return "*";
    if (typeof opt === "string") return opt;
    if (Array.isArray(opt)) return opt.includes(requestOrigin) ? requestOrigin : (opt[0] ?? "*");
    if (typeof opt === "function") return opt(requestOrigin) ? requestOrigin : "";
    return "*";
  }
}
