/**
 * @module @carpentry/http
 * @description HTTP Response — fluent builder producing Web Standard Response
 * @patterns Builder (fluent chaining)
 * @principles SRP — response construction only; LSP — implements IResponse
 */

import type { CookieOptions, IResponse } from "@carpentry/formworks/core/contracts";
import type { Dictionary } from "@carpentry/formworks/core/types";

/**
 * CarpenterResponse — fluent HTTP response builder.
 *
 * Wraps status/body/headers plus optional cookie helpers, and can be converted
 * to a standard Web `Response` via `toNative()`.
 *
 * @example
 * ```ts
 * import { CarpenterResponse } from '..';
 *
 * return CarpenterResponse.json({ ok: true }, 200)
 *   .header('x-request-id', 'abc123');
 * ```
 */
export class CarpenterResponse implements IResponse {
  statusCode: number;
  private responseHeaders: Dictionary<string> = {};
  private responseBody: unknown;
  private cookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  constructor(body: unknown = "", status = 200) {
    this.responseBody = body;
    this.statusCode = status;
  }

  getHeaders(): Dictionary<string> {
    return { ...this.responseHeaders };
  }

  getStatusCode(): number {
    return this.statusCode;
  }

  getBody(): unknown {
    return this.responseBody;
  }

  /** Set a header — fluent Builder pattern */
  /**
   * @param {string} name
   * @param {string} value
   * @returns {this}
   */
  header(name: string, value: string): this {
    this.responseHeaders[name.toLowerCase()] = value;
    return this;
  }

  /** Set status code — fluent */
  /**
   * @param {number} code
   * @returns {this}
   */
  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  /** Set a cookie — fluent */
  /**
   * @param {string} name
   * @param {string} value
   * @param {CookieOptions} [options]
   * @returns {this}
   */
  cookie(name: string, value: string, options: CookieOptions = {}): this {
    this.cookies.push({ name, value, options });
    return this;
  }

  /** Convert to Web Standard Response */
  toNative(): Response {
    const headers = new Headers();

    // Apply headers
    for (const [key, value] of Object.entries(this.responseHeaders)) {
      headers.set(key, value);
    }

    // Apply cookies via Set-Cookie headers
    for (const c of this.cookies) {
      headers.append("set-cookie", this.serializeCookie(c.name, c.value, c.options));
    }

    // Determine body and content-type
    let body: string | null = null;
    if (this.responseBody === null || this.responseBody === undefined) {
      body = null;
    } else if (typeof this.responseBody === "string") {
      body = this.responseBody;
      if (!headers.has("content-type")) {
        headers.set("content-type", "text/html; charset=utf-8");
      }
    } else {
      body = JSON.stringify(this.responseBody);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }
    }

    return new Response(body, { status: this.statusCode, headers });
  }

  // ── Static Factories ────────────────────────────────────

  /**
   * Create a JSON response.
   *
   * Sets `content-type: application/json; charset=utf-8` by default.
   *
   * @param data - Value to JSON-serialize.
   * @param status - HTTP status code (default: 200).
   * @returns New {@link CarpenterResponse} instance.
   *
   * @example
   * ```ts
   * return CarpenterResponse.json({ ok: true });
   * return CarpenterResponse.json({ error: 'Not found' }, 404);
   * ```
   */
  static json(data: unknown, status = 200): CarpenterResponse {
    const res = new CarpenterResponse(data, status);
    res.header("content-type", "application/json; charset=utf-8");
    return res;
  }

  /** Create a redirect response */
  static redirect(url: string, status = 302): CarpenterResponse {
    const res = new CarpenterResponse(null, status);
    res.header("location", url);
    return res;
  }

  /** Create a "not found" response */
  static notFound(message = "Not Found"): CarpenterResponse {
    return CarpenterResponse.json({ error: message }, 404);
  }

  /** Create an empty success response */
  static noContent(): CarpenterResponse {
    return new CarpenterResponse(null, 204);
  }

  /** Create a view response (carries page + props for UI bridge) */
  static view(page: string, props: Dictionary = {}): ViewResponse {
    return new ViewResponse(page, props);
  }

  // ── Cookie serialization ────────────────────────────────

  private serializeCookie(name: string, value: string, opts: CookieOptions): string {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (opts.maxAge !== undefined) cookie += `; Max-Age=${opts.maxAge}`;
    if (opts.path) cookie += `; Path=${opts.path}`;
    if (opts.domain) cookie += `; Domain=${opts.domain}`;
    if (opts.httpOnly) cookie += "; HttpOnly";
    if (opts.secure) cookie += "; Secure";
    if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
    return cookie;
  }
}

/**
 * Response that carries a UI page name and props for SSR / island hydration bridges.
 *
 * @example
 * ```ts
 * import { ViewResponse } from '..';
 * new ViewResponse('Dashboard', { userId: 1 });
 * ```
 */
export class ViewResponse extends CarpenterResponse {
  constructor(
    public readonly page: string,
    public readonly props: Dictionary,
  ) {
    super(null, 200);
  }
}

/** Helper factory function — mirrors Laravel's response() */
/**
 * @param {unknown} [body]
 * @param {number} [status]
 * @returns {CarpenterResponse}
 */
export function response(body: unknown = "", status = 200): CarpenterResponse {
  return new CarpenterResponse(body, status);
}
