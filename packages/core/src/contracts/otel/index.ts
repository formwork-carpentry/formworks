/**
 * @module @carpentry/core/contracts/otel
 * @description OpenTelemetry contracts - tracing, metrics, and span interfaces.
 *
 * Implementations: Tracer, Span, Counter, Histogram, Gauge, MetricsRegistry, OtlpExporter
 *
 * @example
 * ```ts
 * const tracer = container.make<ITracer>('tracer');
 * const span = tracer.startSpan('http.request', { 'http.method': 'GET' });
 * // ... do work ...
 * span.end();
 * ```
 */

/** @typedef {Object} ISpan - A single trace span */
export interface ISpan {
  /** @property {string} traceId - Trace identifier (shared across spans) */
  traceId: string;
  /** @property {string} spanId - Unique span identifier */
  spanId: string;
  /** @property {string} name - Span operation name */
  name: string;

  /**
   * Set an attribute on the span.
   * @param {string} key - Attribute name
   * @param {string | number | boolean} value - Attribute value
   * @returns {void}
   */
  setAttribute(key: string, value: string | number | boolean): void;

  /**
   * Add a timestamped event to the span.
   * @param {string} name - Event name
   * @param {Record<string, unknown>} [attributes] - Event attributes
   * @returns {void}
   */
  addEvent(name: string, attributes?: Record<string, unknown>): void;

  /**
   * Record an error on the span.
   * @param {Error} error - The error that occurred
   * @returns {void}
   */
  recordException(error: Error): void;

  /**
   * End the span (records duration).
   * @returns {void}
   */
  end(): void;
}

/** @typedef {Object} ITracer - Trace span factory */
export interface ITracer {
  /**
   * Start a new span.
   * @param {string} name - Operation name (e.g., 'http.request', 'db.query')
   * @param {Record<string, string | number | boolean>} [attributes] - Initial attributes
   * @returns {ISpan} The new span
   */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): ISpan;
}

/** @typedef {Object} ICounter - Monotonically increasing counter metric */
export interface ICounter {
  /**
   * Increment the counter.
   * @param {number} [value=1] - Amount to add
   * @param {Record<string, string>} [labels] - Metric labels
   * @returns {void}
   */
  inc(value?: number, labels?: Record<string, string>): void;

  /**
   * Get the current counter value.
   * @returns {number}
   */
  value(): number;
}

/** @typedef {Object} IHistogram - Distribution metric (latency, sizes) */
export interface IHistogram {
  /**
   * Record a value in the histogram.
   * @param {number} value - Observed value
   * @param {Record<string, string>} [labels] - Metric labels
   * @returns {void}
   */
  observe(value: number, labels?: Record<string, string>): void;

  /**
   * Get a percentile value.
   * @param {number} percentile - Percentile (0-100, e.g., 95 for p95)
   * @returns {number}
   */
  percentile(percentile: number): number;
}
