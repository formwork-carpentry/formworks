/**
 * @module @formwork/core/contracts/otel
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
export {};
//# sourceMappingURL=index.js.map