/**
 * @module @carpentry/http
 * @description HTTP Request — wraps Web Standard Request with Laravel-style accessors
 * @patterns Immutable Value Object
 * @principles SRP — only request data access; ISP — implements IRequest
 */

import type { IRequest } from "@carpentry/formworks/contracts";
import type { Dictionary } from "@carpentry/formworks/core/types";

/**
 * Request — wraps a standard Web `Request` with Carpenter/Laravel-style helpers.
 *
 * Provides:
 * - accessors for `method()`, `path()`, query/params
 * - `input()`/`all()` that merge query + parsed body
 * - convenience helpers like `wantsJson()` and `ip()`
 *
 * @example
 * ```ts
 * // Inside a controller/handler:
 * const id = req.param('id');
 * const page = Number(req.query('page') ?? 1);
 * ```
 */
export class Request implements IRequest {
  private rawRequest: globalThis.Request;
  private parsedBody: unknown | null = null;
  private bodyParsed = false;
  private routeParams: Dictionary<string> = {};
  private authenticatedUser: unknown | null = null;

  constructor(raw: globalThis.Request, routeParams: Dictionary<string> = {}) {
    this.rawRequest = raw;
    this.routeParams = routeParams;
  }

  method(): string {
    return this.rawRequest.method.toUpperCase();
  }

  path(): string {
    return new URL(this.rawRequest.url).pathname;
  }

  url(): string {
    return this.rawRequest.url;
  }

  /**
   * @param {string} name
   * @returns {string | undefined}
   */
  header(name: string): string | undefined {
    return this.rawRequest.headers.get(name.toLowerCase()) ?? undefined;
  }

  headers(): Dictionary<string> {
    const result: Dictionary<string> = {};
    this.rawRequest.headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * @param {string} key
   * @returns {string | undefined}
   */
  query(key: string): string | undefined {
    return new URL(this.rawRequest.url).searchParams.get(key) ?? undefined;
  }

  /**
   * @param {string} key
   * @returns {string | undefined}
   */
  param(key: string): string | undefined {
    return this.routeParams[key];
  }

  /**
   * @param {string} key
   * @param {T} [defaultValue]
   * @returns {T}
   */
  input<T = unknown>(key: string, defaultValue?: T): T {
    // Check body first, then query
    const bodyData = this.bodySync() as Dictionary | null;
    if (bodyData && typeof bodyData === "object" && key in bodyData) {
      return bodyData[key] as T;
    }
    const queryVal = this.query(key);
    if (queryVal !== undefined) return queryVal as unknown as T;
    return defaultValue as T;
  }

  body<T = unknown>(): T {
    return this.bodySync() as T;
  }

  ip(): string {
    return (
      this.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      this.header("x-real-ip") ??
      "127.0.0.1"
    );
  }

  wantsJson(): boolean {
    const accept = this.header("accept") ?? "";
    return accept.includes("application/json");
  }

  isJson(): boolean {
    const ct = this.header("content-type") ?? "";
    return ct.includes("application/json");
  }

  user<T = unknown>(): T | null {
    return this.authenticatedUser as T | null;
  }

  all(): Dictionary {
    const queryData: Dictionary = {};
    new URL(this.rawRequest.url).searchParams.forEach((value, key) => {
      queryData[key] = value;
    });
    const bodyData = (this.bodySync() as Dictionary) ?? {};
    return { ...queryData, ...bodyData };
  }

  // ── Mutation helpers (return new instances for immutability) ──

  /** Set the authenticated user on this request */
  /**
   * @param {unknown} user
   */
  setUser(user: unknown): void {
    this.authenticatedUser = user;
  }

  /** Set route parameters (called by router after matching) */
  /**
   * @param {Dictionary<string>} params
   */
  setRouteParams(params: Dictionary<string>): void {
    this.routeParams = params;
  }

  /** Parse the raw body. Must be called before sync body access. */
  async parseBody(): Promise<void> {
    if (this.bodyParsed) return;
    this.bodyParsed = true;

    const ct = this.header("content-type") ?? "";
    try {
      if (ct.includes("application/json")) {
        this.parsedBody = await this.rawRequest.json();
      } else if (ct.includes("application/x-www-form-urlencoded")) {
        const text = await this.rawRequest.text();
        const params = new URLSearchParams(text);
        const result: Dictionary = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
        this.parsedBody = result;
      } else if (ct.includes("multipart/form-data")) {
        const formData = await this.rawRequest.formData();
        const result: Dictionary = {};
        formData.forEach((value, key) => {
          result[key] = value;
        });
        this.parsedBody = result;
      } else {
        this.parsedBody = null;
      }
    } catch {
      this.parsedBody = null;
    }
  }

  /** Access to the underlying Web Standard Request */
  raw(): globalThis.Request {
    return this.rawRequest;
  }

  private bodySync(): unknown {
    return this.parsedBody;
  }
}
