/**
 * @module @formwork/otel
 * @description Auto-instrumentation — wraps infrastructure adapters to emit spans automatically
 * @patterns Decorator (wraps adapters), Proxy (intercepts method calls)
 * @principles OCP (add instrumentation without modifying adapters), SRP (tracing only)
 */

import type { Tracer } from "./index.js";

// ── Instrumented HTTP (wraps HttpKernel.handle) ───────────

export interface InstrumentationConfig {
  /** Tracer instance to use */
  tracer: Tracer;
  /** Whether to record request/response bodies (default: false, may be large) */
  recordBodies?: boolean;
  /** Span name prefix (default: '') */
  prefix?: string;
}

/**
 * Wraps an HTTP handler to automatically create spans per request.
 *
 * @param {Function} handler - The HTTP handler to wrap (e.g., kernel.handle)
 * @param {InstrumentationConfig} config - Tracer and options
 * @returns {Function} Instrumented handler that creates spans automatically
 *
 * @example
 * ```ts
 * const handler = instrumentHttp(kernel.handle.bind(kernel), { tracer });
 * const response = await handler(request); // span auto-created
 * ```
 */
export function instrumentHttp<Req, Res>(
  handler: (req: Req) => Promise<Res>,
  config: InstrumentationConfig,
): (req: Req) => Promise<Res> {
  return async (req: Req) => {
    const reqObj = req as Record<string, unknown>;
    const method =
      typeof reqObj.method === "function" ? (reqObj.method as () => string)() : "UNKNOWN";
    const path = typeof reqObj.path === "function" ? (reqObj.path as () => string)() : "/";
    const spanName = `${config.prefix ?? ""}HTTP ${method} ${path}`;

    return config.tracer.trace(spanName, async (span) => {
      span.setAttribute("http.method", method);
      span.setAttribute("http.url", path);
      span.setAttribute("component", "http");

      try {
        const res = await handler(req);
        const resObj = res as Record<string, unknown>;
        if ("statusCode" in resObj) {
          span.setAttribute("http.status_code", resObj.statusCode as number);
        }
        span.setStatus("ok");
        return res;
      } catch (error) {
        span.setAttribute("error", true);
        span.setAttribute("error.message", (error as Error).message);
        span.setStatus("error");
        throw error;
      }
    });
  };
}

/**
 * Wraps a database adapter's execute method with automatic span creation.
 *
 * @param {T} adapter - Database adapter implementing execute()
 * @param {InstrumentationConfig} config - Tracer and options
 * @returns {T} The same adapter with execute() wrapped in tracing spans
 */
export function instrumentDatabase<T extends { execute: (...args: unknown[]) => Promise<unknown> }>(
  adapter: T,
  config: InstrumentationConfig,
): T {
  const original = adapter.execute.bind(adapter);

  adapter.execute = async (...args: unknown[]) => {
    const query = args[0] as { sql?: string; type?: string } | undefined;
    const sql = query?.sql ?? "unknown";
    const type = query?.type ?? "query";
    const spanName = `${config.prefix ?? ""}DB ${type}`;

    return config.tracer.trace(spanName, async (span) => {
      span.setAttribute("db.statement", sql.slice(0, 200)); // truncate long SQL
      span.setAttribute("db.type", type);
      span.setAttribute("component", "database");

      try {
        const result = await original(...args);
        span.setStatus("ok");
        return result;
      } catch (error) {
        span.setAttribute("error", true);
        span.setAttribute("error.message", (error as Error).message);
        span.setStatus("error");
        throw error;
      }
    });
  };

  return adapter;
}

/**
 * Wraps a cache store's get/put/forget with automatic span creation.
 *
 * @param {T} store - Cache store implementing get/put/forget
 * @param {InstrumentationConfig} config - Tracer and options
 * @returns {T} The same store with methods wrapped in tracing spans
 */
export function instrumentCache<
  T extends {
    get: (key: string) => Promise<unknown>;
    put: (key: string, value: unknown, ttl?: number) => Promise<void>;
    forget: (key: string) => Promise<unknown>;
  },
>(store: T, config: InstrumentationConfig): T {
  const origGet = store.get.bind(store);
  const origPut = store.put.bind(store);
  const origForget = store.forget.bind(store);

  store.get = async (key: string) => {
    return config.tracer.trace(`${config.prefix ?? ""}Cache GET`, async (span) => {
      span.setAttribute("cache.key", key);
      span.setAttribute("component", "cache");
      const result = await origGet(key);
      span.setAttribute("cache.hit", result !== null);
      span.setStatus("ok");
      return result;
    });
  };

  store.put = async (key: string, value: unknown, ttl?: number) => {
    return config.tracer.trace(`${config.prefix ?? ""}Cache PUT`, async (span) => {
      span.setAttribute("cache.key", key);
      span.setAttribute("cache.ttl", ttl ?? -1);
      span.setAttribute("component", "cache");
      await origPut(key, value, ttl);
      span.setStatus("ok");
    });
  };

  store.forget = async (key: string) => {
    return config.tracer.trace(`${config.prefix ?? ""}Cache DELETE`, async (span) => {
      span.setAttribute("cache.key", key);
      span.setAttribute("component", "cache");
      const result = await origForget(key);
      span.setStatus("ok");
      return result;
    });
  };

  return store;
}

/**
 * Wraps a queue adapter's push/pop with automatic span creation.
 *
 * @param {T} adapter - Queue adapter implementing push/pop
 * @param {InstrumentationConfig} config - Tracer and options
 * @returns {T} The same adapter with methods wrapped in tracing spans
 */
export function instrumentQueue<
  T extends {
    push: (job: unknown) => Promise<string>;
    pop: (queue?: string) => Promise<unknown>;
  },
>(adapter: T, config: InstrumentationConfig): T {
  const origPush = adapter.push.bind(adapter);
  const origPop = adapter.pop.bind(adapter);

  adapter.push = async (job: unknown) => {
    return config.tracer.trace(`${config.prefix ?? ""}Queue PUSH`, async (span) => {
      const jobObj = job as Record<string, unknown>;
      span.setAttribute("queue.job", (jobObj.name as string) ?? "unknown");
      span.setAttribute("component", "queue");
      const id = await origPush(job);
      span.setAttribute("queue.job_id", id);
      span.setStatus("ok");
      return id;
    });
  };

  adapter.pop = async (queue?: string) => {
    return config.tracer.trace(`${config.prefix ?? ""}Queue POP`, async (span) => {
      span.setAttribute("queue.name", queue ?? "default");
      span.setAttribute("component", "queue");
      const job = await origPop(queue);
      span.setAttribute("queue.empty", job === null);
      span.setStatus("ok");
      return job;
    });
  };

  return adapter;
}
