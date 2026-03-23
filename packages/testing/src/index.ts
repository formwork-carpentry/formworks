/**
 * @module @carpentry/testing
 * @description Testing utilities — TestCase with HTTP helpers, service test doubles, and assertion utilities.
 * @patterns Template Method (TestCase lifecycle), Facade (service test doubles), Builder (TestRequest)
 * @principles SRP — testing infrastructure only; DIP — test doubles satisfy the same interfaces as real services
 *
 * @example
 * ```ts
 * import { TestRequest, TestResponse, assertThrows } from '@carpentry/testing';
 *
 * // Build a synthetic Request for framework/unit tests
 * const req = TestRequest.get('/health').withHeader('x-test', '1').build();
 *
 * // Wrap a response-like object for assertion helpers
 * const res = TestResponse.from({
 *   statusCode: 200,
 *   getBody: () => ({ ok: true }),
 *   getHeaders: () => ({ 'content-type': 'application/json' }),
 * });
 *
 * res.assertOk().assertJsonHas('ok');
 *
 * // Assert functions throw
 * await assertThrows(() => {
 *   throw new Error('boom');
 * }, 'boom');
 * ```
 */

export * from "./database-stubs.js";

// ── TestResponse — wraps a CarpenterResponse for assertions ──

/**
 * Assert helper for response-like objects.
 *
 * Wraps an object with:
 * - `statusCode`
 * - `getBody()`
 * - `getHeaders()`
 *
 * @see TestRequest — Build synthetic requests for unit tests
 */
export class TestResponse {
  constructor(
    private statusCode: number,
    private body: unknown,
    private headers: Record<string, string>,
  ) {}

  /** Assert HTTP status code */
  /**
   * @param {number} expected
   * @returns {this}
   */
  assertStatus(expected: number): this {
    if (this.statusCode !== expected) {
      throw new Error(`Expected status ${expected}, got ${this.statusCode}.`);
    }
    return this;
  }

  assertOk(): this {
    return this.assertStatus(200);
  }
  assertCreated(): this {
    return this.assertStatus(201);
  }
  assertNoContent(): this {
    return this.assertStatus(204);
  }
  assertNotFound(): this {
    return this.assertStatus(404);
  }
  assertUnauthorized(): this {
    return this.assertStatus(401);
  }
  assertForbidden(): this {
    return this.assertStatus(403);
  }
  assertUnprocessable(): this {
    return this.assertStatus(422);
  }

  /** Assert response body contains JSON key */
  /**
   * @param {string} key
   * @returns {this}
   */
  assertJsonHas(key: string): this {
    const obj = this.body as Record<string, unknown>;
    if (!(key in obj)) {
      throw new Error(
        `Expected JSON key "${key}" but it's missing. Keys: ${Object.keys(obj).join(", ")}`,
      );
    }
    return this;
  }

  /** Assert response body matches structure */
  /**
   * @param {unknown} expected
   * @returns {this}
   */
  assertJsonEquals(expected: unknown): this {
    const actual = JSON.stringify(this.body);
    const exp = JSON.stringify(expected);
    if (actual !== exp) {
      throw new Error(`JSON mismatch.\nExpected: ${exp}\nActual: ${actual}`);
    }
    return this;
  }

  /** Assert response body contains a subset */
  /**
   * @param {Object} subset
   * @returns {this}
   */
  assertJsonContains(subset: Record<string, unknown>): this {
    const obj = this.body as Record<string, unknown>;
    for (const [key, value] of Object.entries(subset)) {
      if (JSON.stringify(obj[key]) !== JSON.stringify(value)) {
        throw new Error(
          `JSON key "${key}" mismatch. Expected: ${JSON.stringify(value)}, Got: ${JSON.stringify(obj[key])}`,
        );
      }
    }
    return this;
  }

  /** Assert header exists with optional value check */
  /**
   * @param {string} name
   * @param {string} [value]
   * @returns {this}
   */
  assertHeader(name: string, value?: string): this {
    const headerVal = this.headers[name.toLowerCase()];
    if (headerVal === undefined) {
      throw new Error(`Expected header "${name}" but it's missing.`);
    }
    if (value !== undefined && headerVal !== value) {
      throw new Error(`Header "${name}" expected "${value}", got "${headerVal}".`);
    }
    return this;
  }

  /** Assert validation errors contain a specific field */
  /**
   * @param {string} field
   * @returns {this}
   */
  assertValidationError(field: string): this {
    this.assertStatus(422);
    const body = this.body as { errors?: Record<string, string[]> };
    if (!body.errors?.[field]) {
      throw new Error(`Expected validation error for "${field}" but none found.`);
    }
    return this;
  }

  /** Get the raw body */
  getBody(): unknown {
    return this.body;
  }
  getStatus(): number {
    return this.statusCode;
  }
  getHeaders(): Record<string, string> {
    return { ...this.headers };
  }

  /** Static factory from a CarpenterResponse-like object */
  static from(response: {
    statusCode: number;
    getBody(): unknown;
    getHeaders(): Record<string, string>;
  }): TestResponse {
    return new TestResponse(response.statusCode, response.getBody(), response.getHeaders());
  }
}

// ── TestRequest Builder ───────────────────────────────────

/**
 * Builder for synthetic HTTP `Request` instances.
 *
 * This is useful when you want to unit-test route handlers or middleware
 * without needing a live HTTP server.
 *
 * @see TestResponse — Assert response status/body/headers
 */
export class TestRequest {
  private method = "GET";
  private url = "http://localhost/";
  private requestHeaders: Record<string, string> = {};
  private requestBody?: string;

  static get(path: string): TestRequest {
    return new TestRequest().setMethod("GET").setPath(path);
  }
  static post(path: string): TestRequest {
    return new TestRequest().setMethod("POST").setPath(path);
  }
  static put(path: string): TestRequest {
    return new TestRequest().setMethod("PUT").setPath(path);
  }
  static patch(path: string): TestRequest {
    return new TestRequest().setMethod("PATCH").setPath(path);
  }
  static delete(path: string): TestRequest {
    return new TestRequest().setMethod("DELETE").setPath(path);
  }

  private setMethod(m: string): this {
    this.method = m;
    return this;
  }
  private setPath(p: string): this {
    this.url = `http://localhost${p.startsWith("/") ? p : `/${p}`}`;
    return this;
  }

  /**
   * @param {string} name
   * @param {string} value
   * @returns {this}
   */
  withHeader(name: string, value: string): this {
    this.requestHeaders[name] = value;
    return this;
  }

  /**
   * @param {string} token
   * @param {string} [type]
   * @returns {this}
   */
  withToken(token: string, type = "Bearer"): this {
    return this.withHeader("Authorization", `${type} ${token}`);
  }

  /**
   * @param {Object} data
   * @returns {this}
   */
  withJson(data: Record<string, unknown>): this {
    this.requestHeaders["Content-Type"] = "application/json";
    this.requestBody = JSON.stringify(data);
    return this;
  }

  /**
   * @param {string} body
   * @param {string} [contentType]
   * @returns {this}
   */
  withBody(body: string, contentType = "text/plain"): this {
    this.requestHeaders["Content-Type"] = contentType;
    this.requestBody = body;
    return this;
  }

  /** Build the native Request object */
  build(): globalThis.Request {
    const init: RequestInit = {
      method: this.method,
      headers: this.requestHeaders,
    };
    if (this.requestBody && this.method !== "GET" && this.method !== "HEAD") {
      init.body = this.requestBody;
    }
    return new globalThis.Request(this.url, init);
  }
}

// ── Assertion Helpers ─────────────────────────────────────

/**
 * Assert a function throws an error with a specific message or type.
 */
export async function assertThrows(
  fn: () => unknown | Promise<unknown>,
  expectedMessage?: string | RegExp,
  expectedType?: new (...args: unknown[]) => Error,
): Promise<void> {
  let threw = false;
  let caughtError: Error | undefined;

  try {
    await fn();
  } catch (error) {
    threw = true;
    caughtError = error as Error;
  }

  /**
   * @param {unknown} !threw
   */
  if (!threw) {
    throw new Error("Expected function to throw, but it did not.");
  }

  /**
   * @param {unknown} expectedType && !(caughtError instanceof expectedType
   */
  if (expectedType && caughtError && !(caughtError instanceof expectedType)) {
    throw new Error("Expected error of requested type.");
  }

  /**
   * @param {unknown} expectedMessage
   */
  if (expectedMessage) {
    const msg = caughtError?.message ?? "";
    if (typeof expectedMessage === "string" && !msg.includes(expectedMessage)) {
      throw new Error(`Expected error message containing "${expectedMessage}", got "${msg}".`);
    }
    if (expectedMessage instanceof RegExp && !expectedMessage.test(msg)) {
      throw new Error(`Expected error message matching ${expectedMessage}, got "${msg}".`);
    }
  }
}

/**
 * Assert that a async function completes within a time limit.
 */
export async function assertCompletesWithin(
  fn: () => Promise<unknown>,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  await fn();
  const elapsed = Date.now() - start;
  /**
   * @param {unknown} elapsed > timeoutMs
   */
  if (elapsed > timeoutMs) {
    throw new Error(`Expected to complete within ${timeoutMs}ms, took ${elapsed}ms.`);
  }
}

// ── FakeClock ─────────────────────────────────────────────

/**
 * Simple deterministic clock for testing time-dependent code.
 */
export class FakeClock {
  private currentTime: number;

  constructor(startTime: number = Date.now()) {
    this.currentTime = startTime;
  }

  now(): number {
    return this.currentTime;
  }
  /**
   * @param {number} ms
   */
  advance(ms: number): void {
    this.currentTime += ms;
  }
  /**
   * @param {number} time
   */
  set(time: number): void {
    this.currentTime = time;
  }
  toDate(): Date {
    return new Date(this.currentTime);
  }
}

export { BenchmarkSuite, SlaContract } from "./Benchmark.js";
export type { BenchmarkResult, SuiteResult, BenchmarkOptions } from "./Benchmark.js";
