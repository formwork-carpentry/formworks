/**
 * @module @carpentry/http-client
 * @description Outbound HTTP client — fluent request builder, timeout/retry support, and deterministic test-double transport support.
 *
 * Use this package to:
 * - Build outgoing requests with a fluent API (`HttpClient` → `RequestBuilder`)
 * - Queue deterministic test responses in unit tests with `FakeTransport`
 * - Reuse a configured transport (baseUrl, headers, auth)
 *
 * @example
 * ```ts
 * import { HttpClient, FakeTransport } from './';
 *
 * const transport = new FakeTransport().setDefault({
 *   status: 200,
 *   body: { ok: true },
 * });
 *
 * const client = new HttpClient(transport).withBaseUrl('https://api.example.com');
 * const res = await client.get('/health').send();
 *
 * if (res.ok) {
 *   console.log(await res.json());
 * }
 * ```
 * @patterns Builder (request), Strategy (transport), Proxy (test double)
 */

// ── Types ─────────────────────────────────────────────────

export interface HttpClientResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  ok: boolean;
  json<T = unknown>(): T;
  text(): string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface PendingRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  bodyData?: unknown;
  timeoutMs: number;
  retries: number;
  retryDelay: number;
}

// ── HttpClient — fluent request builder ───────────────────

/**
 * Outbound HTTP client with a fluent request builder.
 *
 * Internally, the client delegates HTTP execution to a transport implementing {@link HttpTransport}
 * (real fetch by default, or the {@link FakeTransport} test double in tests).
 *
 * @example
 * ```ts
 * const client = new HttpClient()
 *   .withBaseUrl('https://api.example.com')
 *   .timeout(5_000);
 *
 * const res = await client.get('/users/1').send();
 * const user = await res.json<{ id: 1 }>();
 * ```
 *
 * @see RequestBuilder — Build and send a request
 * @see FakeTransport — Deterministic test-double transport
 */
export class HttpClient {
  private baseUrl = "";
  private defaultHeaders: Record<string, string> = {};
  private defaultTimeout = 30000;
  private transport: HttpTransport;

  constructor(transport?: HttpTransport) {
    this.transport = transport ?? new FetchTransport();
  }

  /** Set base URL for all requests */
  /**
   * @param {string} url
   * @returns {this}
   */
  withBaseUrl(url: string): this {
    this.baseUrl = url.replace(/\/$/, "");
    return this;
  }

  /** Set default headers */
  /**
   * @param {Record<string, string>} headers
   * @returns {this}
   */
  withHeaders(headers: Record<string, string>): this {
    Object.assign(this.defaultHeaders, headers);
    return this;
  }

  /** Set bearer token */
  /**
   * @param {string} token
   * @returns {this}
   */
  withToken(token: string): this {
    this.defaultHeaders.Authorization = `Bearer ${token}`;
    return this;
  }

  /** Set basic auth */
  /**
   * @param {string} username
   * @param {string} password
   * @returns {this}
   */
  withBasicAuth(username: string, password: string): this {
    this.defaultHeaders.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    return this;
  }

  /** Set default timeout */
  /**
   * @param {number} ms
   * @returns {this}
   */
  timeout(ms: number): this {
    this.defaultTimeout = ms;
    return this;
  }

  // ── Request methods ─────────────────────────────────────

  /**
   * @param {string} url
   * @param {Record<string, string>} [query]
   * @returns {RequestBuilder}
   */
  get(url: string, query?: Record<string, string>): RequestBuilder {
    return this.request("GET", url).query(query ?? {});
  }

  /**
   * @param {string} url
   * @param {unknown} [body]
   * @returns {RequestBuilder}
   */
  post(url: string, body?: unknown): RequestBuilder {
    return this.request("POST", url).body(body);
  }

  /**
   * @param {string} url
   * @param {unknown} [body]
   * @returns {RequestBuilder}
   */
  put(url: string, body?: unknown): RequestBuilder {
    return this.request("PUT", url).body(body);
  }

  /**
   * @param {string} url
   * @param {unknown} [body]
   * @returns {RequestBuilder}
   */
  patch(url: string, body?: unknown): RequestBuilder {
    return this.request("PATCH", url).body(body);
  }

  /**
   * @param {string} url
   * @param {unknown} [body]
   * @returns {RequestBuilder}
   */
  delete(url: string, body?: unknown): RequestBuilder {
    return this.request("DELETE", url).body(body);
  }

  /**
   * @param {string} url
   * @returns {RequestBuilder}
   */
  head(url: string): RequestBuilder {
    return this.request("HEAD", url);
  }

  private request(method: HttpMethod, url: string): RequestBuilder {
    const fullUrl = url.startsWith("http")
      ? url
      : `${this.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
    return new RequestBuilder(this.transport, {
      method,
      url: fullUrl,
      headers: { ...this.defaultHeaders },
      query: {},
      timeoutMs: this.defaultTimeout,
      retries: 0,
      retryDelay: 100,
    });
  }
}

// ── RequestBuilder ────────────────────────────────────────

/**
 * RequestBuilder — fluent builder for an outbound HTTP request.
 *
 * Create it via {@link HttpClient.get}/post/etc, then configure headers/query/body,
 * optional retry behavior, and finally execute with `send()`.
 *
 * @example
 * ```ts
 * import { HttpClient } from './';
 *
 * const client = new HttpClient()
 *   .withBaseUrl('https://api.example.com')
 *   .timeout(5_000);
 *
 * const res = await client
 *   .get('/users/1', { include: 'roles' })
 *   .asJson()
 *   .retry(2, 250)
 *   .send();
 *
 * if (res.ok) {
 *   const user = await res.json<{ id: number }>();
 * }
 * ```
 */
export class RequestBuilder {
  constructor(
    private transport: HttpTransport,
    private pending: PendingRequest,
  ) {}

  /**
   * @param {string} key
   * @param {string} value
   * @returns {this}
   */
  header(key: string, value: string): this {
    this.pending.headers[key] = value;
    return this;
  }
  /**
   * @param {Record<string, string>} h
   * @returns {this}
   */
  headers(h: Record<string, string>): this {
    Object.assign(this.pending.headers, h);
    return this;
  }
  /**
   * @param {Record<string, string>} q
   * @returns {this}
   */
  query(q: Record<string, string>): this {
    Object.assign(this.pending.query, q);
    return this;
  }
  /**
   * @param {unknown} data
   * @returns {this}
   */
  body(data: unknown): this {
    this.pending.bodyData = data;
    return this;
  }
  /**
   * @param {number} ms
   * @returns {this}
   */
  timeout(ms: number): this {
    this.pending.timeoutMs = ms;
    return this;
  }
  /**
   * @param {number} times
   * @param {number} [delayMs]
   * @returns {this}
   */
  retry(times: number, delayMs = 100): this {
    this.pending.retries = times;
    this.pending.retryDelay = delayMs;
    return this;
  }
  asJson(): this {
    this.pending.headers["Content-Type"] = "application/json";
    return this;
  }
  asForm(): this {
    this.pending.headers["Content-Type"] = "application/x-www-form-urlencoded";
    return this;
  }
  /**
   * @param {string} mime
   * @returns {this}
   */
  accept(mime: string): this {
    this.pending.headers.Accept = mime;
    return this;
  }

  /** Execute the request */
  async send(): Promise<HttpClientResponse> {
    let lastError: Error | null = null;
    const maxAttempts = 1 + this.pending.retries;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.transport.execute(this.pending);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, this.pending.retryDelay));
        }
      }
    }
    throw lastError;
  }
}

// ── Transport Interface ───────────────────────────────────

export interface HttpTransport {
  /**
   * @param {PendingRequest} request
   * @returns {Promise<HttpClientResponse>}
   */
  execute(request: PendingRequest): Promise<HttpClientResponse>;
}

// ── FetchTransport — real HTTP using global fetch ─────────

/**
 * FetchTransport — real HTTP transport based on global `fetch`.
 *
 * Applies:
 * - request timeout via `AbortController`
 * - JSON/form/string body encoding based on `Content-Type`
 */
export class FetchTransport implements HttpTransport {
  /**
   * @param {PendingRequest} request
   * @returns {Promise<HttpClientResponse>}
   */
  async execute(request: PendingRequest): Promise<HttpClientResponse> {
    let url = request.url;
    const queryStr = new URLSearchParams(request.query).toString();
    if (queryStr) url += `?${queryStr}`;

    const init: RequestInit = { method: request.method, headers: request.headers };
    this.attachBody(request, init);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);
    init.signal = controller.signal;

    try {
      const response = await fetch(url, init);
      clearTimeout(timeoutId);
      return this.parseResponse(response);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private attachBody(request: PendingRequest, init: RequestInit): void {
    if (request.bodyData === undefined || request.method === "GET" || request.method === "HEAD")
      return;
    if (request.headers["Content-Type"]?.includes("json")) {
      init.body = JSON.stringify(request.bodyData);
    } else if (typeof request.bodyData === "string") {
      init.body = request.bodyData;
    } else {
      init.body = JSON.stringify(request.bodyData);
      if (!request.headers["Content-Type"]) request.headers["Content-Type"] = "application/json";
    }
  }

  private async parseResponse(response: Response): Promise<HttpClientResponse> {
    const contentType = response.headers.get("content-type") ?? "";
    const bodyText = await response.text();
    const bodyJson = contentType.includes("json") ? JSON.parse(bodyText) : bodyText;
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return {
      status: response.status,
      headers,
      body: bodyJson,
      ok: response.ok,
      json: <T>() => bodyJson as T,
      text: () => bodyText,
    };
  }
}

// ── FakeTransport — records requests, returns queued responses ──

export interface StubbedResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * FakeTransport — deterministic transport for tests.
 *
 * Queue stubbed responses with `queue()`; each call to `execute()` consumes the next
 * queued response (FIFO). When the queue is empty, it returns `defaultResponse`.
 *
 * Use `getRecorded()` and `assert*()` helpers to verify what requests were sent.
 *
 * @example
 * ```ts
 * import { HttpClient, FakeTransport } from './';
 *
 * const transport = new FakeTransport()
 *   .setDefault({ status: 200, body: { ok: true } })
 *   .queue({ status: 201, body: { id: 1 } });
 *
 * const client = new HttpClient(transport).withBaseUrl('https://api.example.com');
 *
 * const res1 = await client.post('/users', { name: 'Alice' }).send();
 * const res2 = await client.get('/health').send();
 *
 * transport.assertSent('POST', '/users');
 * transport.assertSent('GET', '/health');
 * ```
 */
export class FakeTransport implements HttpTransport {
  private responses: Array<StubbedResponse | ((req: PendingRequest) => StubbedResponse)> = [];
  private recorded: PendingRequest[] = [];
  private defaultResponse: StubbedResponse = { status: 200, body: {} };

  /** Queue a response (FIFO) */
  /**
   * @param {StubbedResponse | ((req: PendingRequest) => StubbedResponse)} response
   * @returns {this}
   */
  queue(response: StubbedResponse | ((req: PendingRequest) => StubbedResponse)): this {
    this.responses.push(response);
    return this;
  }

  /** Set default response when queue is empty */
  /**
   * @param {StubbedResponse} response
   * @returns {this}
   */
  setDefault(response: StubbedResponse): this {
    this.defaultResponse = response;
    return this;
  }

  /**
   * @param {PendingRequest} request
   * @returns {Promise<HttpClientResponse>}
   */
  async execute(request: PendingRequest): Promise<HttpClientResponse> {
    this.recorded.push({ ...request });

    const next = this.responses.shift();
    const stub = next ? (typeof next === "function" ? next(request) : next) : this.defaultResponse;

    const status = stub.status ?? 200;
    const body = stub.body ?? {};
    const headers = stub.headers ?? {};

    return {
      status,
      headers,
      body,
      ok: status >= 200 && status < 300,
      json: <T>() => body as T,
      text: () => (typeof body === "string" ? body : JSON.stringify(body)),
    };
  }

  // ── Test helpers ──────────────────────────────────────

  getRecorded(): PendingRequest[] {
    return [...this.recorded];
  }

  /**
   * @param {HttpMethod} method
   * @param {string} [urlFragment]
   */
  assertSent(method: HttpMethod, urlFragment?: string): void {
    const match = this.recorded.some(
      (r) => r.method === method && (urlFragment === undefined || r.url.includes(urlFragment)),
    );
    if (!match)
      throw new Error(
        `Expected ${method} request${urlFragment ? ` to "${urlFragment}"` : ""}, but none found.`,
      );
  }

  /**
   * @param {HttpMethod} method
   * @param {string} [urlFragment]
   */
  assertNotSent(method: HttpMethod, urlFragment?: string): void {
    const match = this.recorded.some(
      (r) => r.method === method && (urlFragment === undefined || r.url.includes(urlFragment)),
    );
    if (match)
      throw new Error(
        `Expected NO ${method} request${urlFragment ? ` to "${urlFragment}"` : ""}, but one was found.`,
      );
  }

  /**
   * @param {number} count
   */
  assertSentCount(count: number): void {
    if (this.recorded.length !== count)
      throw new Error(`Expected ${count} requests, got ${this.recorded.length}.`);
  }

  /**
   * @param {string} key
   * @param {string} [value]
   */
  assertSentWithHeader(key: string, value?: string): void {
    const match = this.recorded.some(
      (r) => key in r.headers && (value === undefined || r.headers[key] === value),
    );
    if (!match)
      throw new Error(`Expected request with header "${key}"${value ? `="${value}"` : ""}.`);
  }

  /**
   * @param {(body: unknown} predicate
   */
  assertSentWithBody(predicate: (body: unknown) => boolean): void {
    if (!this.recorded.some((r) => predicate(r.bodyData))) {
      throw new Error("No request matched the body predicate.");
    }
  }

  assertNothingSent(): void {
    if (this.recorded.length > 0)
      throw new Error(`Expected no requests, but ${this.recorded.length} were sent.`);
  }

  reset(): void {
    this.recorded = [];
    this.responses = [];
  }
}
