/**
 * @module @carpentry/otel
 * @description OpenTelemetry-compatible tracing and metrics — in-memory for testing, pluggable exporters
 * @patterns Strategy (exporters), Builder (span), Observer (metric recording)
 * @principles OCP — new exporters (Jaeger, Zipkin, OTLP) without modifying core
 *             DIP — app depends on Tracer/Metrics, not on specific backends
 *
 * Use this package to:
 * - Record tracing spans in-process with {@link Tracer}
 * - Instrument framework-adapter layers using helpers from {@link instrumentHttp}
 * - Export recorded spans/metrics to OTLP-compatible collectors with {@link OtlpExporter}
 *
 * @example
 * ```ts
 * import { Tracer, OtlpExporter, instrumentHttp } from '@carpentry/otel';
 *
 * const tracer = new Tracer();
 * const exporter = new OtlpExporter({
 *   endpoint: 'http://localhost:4318/v1/traces',
 *   serviceName: 'my-api',
 * });
 *
 * const handler = async (req: { method: string; path: string }) => ({ statusCode: 200 });
 * const wrapped = instrumentHttp(handler, { tracer, recordBodies: false });
 *
 * await wrapped({ method: 'GET', path: '/health' });
 *
 * for (const span of tracer.getSpans()) exporter.addSpan(span);
 * await exporter.flush();
 * ```
 */

// ── Span ──────────────────────────────────────────────────

export type SpanStatus = "ok" | "error" | "unset";

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

/**
 * Span — a single unit of work within a trace.
 *
 * Spans are created and managed by {@link Tracer}. You can enrich a span with:
 * - attributes via `setAttribute()` / `setAttributes()`
 * - events via `addEvent()`
 * - status via `setStatus()`
 * - termination via `end()`
 *
 * `duration()` returns the elapsed time in milliseconds.
 *
 * @example
 * ```ts
 * const tracer = new Tracer();
 *
 * await tracer.trace('db.query', async (span) => {
 *   span.setAttribute('db.system', 'sqlite');
 *   span.addEvent('start');
 *   // ... do work ...
 * });
 *
 * const span = tracer.getSpans()[0];
 * // span.duration() > 0
 * ```
 */
export class Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  readonly parentSpanId?: string;
  readonly startTime: number;
  endTime?: number;
  status: SpanStatus = "unset";
  attributes: Record<string, unknown> = {};
  events: SpanEvent[] = [];
  private ended = false;

  constructor(name: string, traceId: string, spanId: string, parentSpanId?: string) {
    this.name = name;
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.startTime = Date.now();
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {this}
   */
  setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value;
    return this;
  }

  /**
   * @param {Object} attrs
   * @returns {this}
   */
  setAttributes(attrs: Record<string, unknown>): this {
    Object.assign(this.attributes, attrs);
    return this;
  }

  /**
   * @param {string} name
   * @param {Object} [attributes]
   * @returns {this}
   */
  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.events.push({ name, timestamp: Date.now(), attributes });
    return this;
  }

  /**
   * @param {SpanStatus} status
   * @returns {this}
   */
  setStatus(status: SpanStatus): this {
    this.status = status;
    return this;
  }

  end(): void {
    if (this.ended) return;
    this.endTime = Date.now();
    this.ended = true;
  }

  isEnded(): boolean {
    return this.ended;
  }

  duration(): number {
    return (this.endTime ?? Date.now()) - this.startTime;
  }
}

// ── Tracer ────────────────────────────────────────────────

/**
 * Tracer — in-memory tracing engine for tests/dev.
 *
 * Use `startSpan()` to manually create spans, or use `trace()` to wrap an async function:
 * it creates a span, sets status to `ok`/`error`, and automatically ends the span.
 *
 * @example
 * ```ts
 * const tracer = new Tracer();
 *
 * await tracer.trace('http.request', async (span) => {
 *   span.setAttribute('http.method', 'GET');
 *   span.setStatus('ok');
 * });
 *
 * // tracer.getSpans().length === 1
 * ```
 */
export class Tracer {
  private spans: Span[] = [];
  private activeSpan: Span | null = null;
  private idCounter = 0;

  /** Start a new span */
  /**
   * @param {string} name
   * @param {Span} [parentSpan]
   * @returns {Span}
   */
  startSpan(name: string, parentSpan?: Span): Span {
    const traceId = parentSpan?.traceId ?? this.generateId("trace");
    const spanId = this.generateId("span");
    const span = new Span(name, traceId, spanId, parentSpan?.spanId);
    this.spans.push(span);
    this.activeSpan = span;
    return span;
  }

  /** Run a function within a span — auto-ends and records errors */
  /**
   * @param {string} name
   * @param {(span: Span} fn
   * @returns {Promise<T>}
   */
  async trace<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = this.startSpan(name, this.activeSpan ?? undefined);
    try {
      const result = await fn(span);
      span.setStatus("ok");
      return result;
    } catch (error) {
      span.setStatus("error");
      span.setAttribute("error.message", (error as Error).message);
      span.setAttribute("error.stack", (error as Error).stack);
      throw error;
    } finally {
      span.end();
      this.activeSpan = null;
    }
  }

  /** Get the currently active span */
  getActiveSpan(): Span | null {
    return this.activeSpan;
  }

  /** Get all recorded spans */
  getSpans(): Span[] {
    return [...this.spans];
  }

  /** Get spans for a specific trace */
  /**
   * @param {string} traceId
   * @returns {Span[]}
   */
  getTrace(traceId: string): Span[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  /** Reset all spans */
  reset(): void {
    this.spans = [];
    this.activeSpan = null;
    this.idCounter = 0;
  }

  // ── Assertions ──────────────────────────────────────────

  /**
   * @param {string} name
   */
  assertSpanExists(name: string): void {
    if (!this.spans.some((s) => s.name === name)) {
      const names = this.spans.map((s) => s.name).join(", ");
      throw new Error(`Expected span "${name}" but not found. Spans: [${names}]`);
    }
  }

  /**
   * @param {string} name
   * @param {SpanStatus} status
   */
  assertSpanStatus(name: string, status: SpanStatus): void {
    const span = this.spans.find((s) => s.name === name);
    if (!span) throw new Error(`Span "${name}" not found.`);
    if (span.status !== status)
      throw new Error(`Span "${name}" status: "${span.status}", expected "${status}".`);
  }

  /**
   * @param {number} count
   */
  assertSpanCount(count: number): void {
    if (this.spans.length !== count)
      throw new Error(`Expected ${count} spans, got ${this.spans.length}.`);
  }

  private generateId(prefix: string): string {
    return `${prefix}-${++this.idCounter}-${Date.now().toString(36)}`;
  }
}

// ── Metrics ───────────────────────────────────────────────

/**
 * Counter — in-memory monotonic counter.
 *
 * Call `add()` to increment by a value, then use `getValue()` to retrieve the total.
 */
export class Counter {
  private value = 0;
  constructor(
    readonly name: string,
    readonly description: string = "",
  ) {}

  /**
   * @param {number} [amount]
   */
  add(amount = 1, _attributes?: Record<string, unknown>): void {
    this.value += amount;
  }

  getValue(): number {
    return this.value;
  }
  reset(): void {
    this.value = 0;
  }
}

/**
 * Histogram — in-memory distribution recorder.
 *
 * Call `record(value)` for each observation. You can then compute aggregates like:
 * `count()`, `sum()`, `min()`, `max()`, `avg()`, and `percentile(p)`.
 */
export class Histogram {
  private values: number[] = [];
  constructor(
    readonly name: string,
    readonly description: string = "",
  ) {}

  /**
   * @param {number} value
   */
  record(value: number, _attributes?: Record<string, unknown>): void {
    this.values.push(value);
  }

  getValues(): number[] {
    return [...this.values];
  }
  count(): number {
    return this.values.length;
  }
  sum(): number {
    return this.values.reduce((a, b) => a + b, 0);
  }
  min(): number {
    return this.values.length > 0 ? Math.min(...this.values) : 0;
  }
  max(): number {
    return this.values.length > 0 ? Math.max(...this.values) : 0;
  }
  avg(): number {
    return this.values.length > 0 ? this.sum() / this.values.length : 0;
  }

  /**
   * @param {number} p
   * @returns {number}
   */
  percentile(p: number): number {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  reset(): void {
    this.values = [];
  }
}

/**
 * Gauge — in-memory instantaneous value.
 *
 * Call `set(value)` to overwrite the current value. Optionally use `increment()`/
 * `decrement()` for relative changes.
 */
export class Gauge {
  private value = 0;
  constructor(
    readonly name: string,
    readonly description: string = "",
  ) {}

  /**
   * @param {number} value
   */
  set(value: number, _attributes?: Record<string, unknown>): void {
    this.value = value;
  }
  /**
   * @param {number} [amount]
   */
  increment(amount = 1): void {
    this.value += amount;
  }
  /**
   * @param {number} [amount]
   */
  decrement(amount = 1): void {
    this.value -= amount;
  }
  getValue(): number {
    return this.value;
  }
  reset(): void {
    this.value = 0;
  }
}

// ── MetricsRegistry ───────────────────────────────────────

/**
 * MetricsRegistry — creates and stores in-memory metric instances by name.
 *
 * This registry is compatible with {@link OtlpExporter} batching: collect metrics with
 * `counter()`, `histogram()`, and `gauge()`, then export them via the exporter.
 *
 * @example
 * ```ts
 * const registry = new MetricsRegistry();
 *
 * registry.counter('requests_total').add(1);
 * registry.histogram('latency_ms').record(120);
 * registry.gauge('in_flight').set(3);
 * ```
 */
export class MetricsRegistry {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private gauges = new Map<string, Gauge>();

  /**
   * @param {string} name
   * @param {string} [description]
   * @returns {Counter}
   */
  counter(name: string, description?: string): Counter {
    if (!this.counters.has(name)) this.counters.set(name, new Counter(name, description));
    const counter = this.counters.get(name);
    return counter ?? new Counter(name, description);
  }

  /**
   * @param {string} name
   * @param {string} [description]
   * @returns {Histogram}
   */
  histogram(name: string, description?: string): Histogram {
    if (!this.histograms.has(name)) this.histograms.set(name, new Histogram(name, description));
    const histogram = this.histograms.get(name);
    return histogram ?? new Histogram(name, description);
  }

  /**
   * @param {string} name
   * @param {string} [description]
   * @returns {Gauge}
   */
  gauge(name: string, description?: string): Gauge {
    if (!this.gauges.has(name)) this.gauges.set(name, new Gauge(name, description));
    const gauge = this.gauges.get(name);
    return gauge ?? new Gauge(name, description);
  }

  getCounters(): Map<string, Counter> {
    return new Map(this.counters);
  }
  getHistograms(): Map<string, Histogram> {
    return new Map(this.histograms);
  }
  getGauges(): Map<string, Gauge> {
    return new Map(this.gauges);
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export { OtlpExporter } from "./OtlpExporter.js";
export type {
  OtlpExporterConfig,
  OtlpExportResult,
  OtlpExportPayload,
  OtlpSpan,
  OtlpMetric,
} from "./OtlpExporter.js";

export {
  instrumentHttp,
  instrumentDatabase,
  instrumentCache,
  instrumentQueue,
} from "./instrumentation.js";
export type { InstrumentationConfig } from "./instrumentation.js";
