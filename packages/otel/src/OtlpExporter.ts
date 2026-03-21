/**
 * @module @formwork/otel
 * @description OTLP JSON Exporter — exports spans and metrics in OpenTelemetry Protocol format
 * @patterns Adapter (converts internal spans→OTLP), Strategy (configurable endpoint)
 * @principles SRP (export only), OCP (add exporters without modifying Tracer/MetricsRegistry)
 */

import type { Span } from "./index.js";

// ── OTLP Types ────────────────────────────────────────────

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number; message?: string };
  events: Array<{ name: string; timeUnixNano: string; attributes: OtlpAttribute[] }>;
}

export interface OtlpAttribute {
  key: string;
  value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean };
}

export interface OtlpMetric {
  name: string;
  description?: string;
  unit?: string;
  data: OtlpMetricData;
}

export interface OtlpMetricData {
  dataPoints: Array<{
    timeUnixNano: string;
    asDouble?: number;
    asInt?: string;
    attributes: OtlpAttribute[];
  }>;
}

export interface OtlpExportPayload {
  resourceSpans?: Array<{
    resource: { attributes: OtlpAttribute[] };
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: OtlpSpan[];
    }>;
  }>;
  resourceMetrics?: Array<{
    resource: { attributes: OtlpAttribute[] };
    scopeMetrics: Array<{
      scope: { name: string; version: string };
      metrics: OtlpMetric[];
    }>;
  }>;
}

// ── Exporter Config ───────────────────────────────────────

export interface OtlpExporterConfig {
  /** OTLP endpoint URL (e.g., http://localhost:4318/v1/traces) */
  endpoint: string;
  /** Service name for resource attributes */
  serviceName?: string;
  /** Service version */
  serviceVersion?: string;
  /** Additional resource attributes */
  resourceAttributes?: Record<string, string | number | boolean>;
  /** Custom headers for the export request */
  headers?: Record<string, string>;
  /** Batch size before auto-export (default: 100) */
  batchSize?: number;
  /** Export interval in ms (default: 5000) */
  exportIntervalMs?: number;
  /** Custom fetch implementation (for testing) */
  fetchFn?: typeof fetch;
}

// ── Converter Functions ───────────────────────────────────

function toNano(ms: number): string {
  /**
   * @param {unknown} BigInt(ms
   */
  return (BigInt(ms) * BigInt(1_000_000)).toString();
}

function toOtlpAttribute(key: string, value: unknown): OtlpAttribute {
  /**
   * @param {unknown} [typeof value === 'string']
   */
  if (typeof value === "string") return { key, value: { stringValue: value } };
  /**
   * @param {unknown} [typeof value === 'number']
   */
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { key, value: { intValue: String(value) } };
    return { key, value: { doubleValue: value } };
  }
  /**
   * @param {unknown} [typeof value === 'boolean']
   */
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { stringValue: String(value) } };
}

function convertSpan(span: Span): OtlpSpan {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    kind: 1, // INTERNAL
    startTimeUnixNano: toNano(span.startTime),
    endTimeUnixNano: toNano(span.endTime ?? Date.now()),
    attributes: Object.entries(span.attributes).map(([k, v]) => toOtlpAttribute(k, v)),
    status: {
      code: span.status === "error" ? 2 : span.status === "ok" ? 1 : 0,
    },
    events: span.events.map((e) => ({
      name: e.name,
      timeUnixNano: toNano(e.timestamp),
      attributes: Object.entries(e.attributes ?? {}).map(([k, v]) => toOtlpAttribute(k, v)),
    })),
  };
}

// ── OTLP Exporter ─────────────────────────────────────────

/**
 * OTLP JSON Exporter — batches and sends spans/metrics to an OTLP collector.
 *
 * @example
 * ```ts
 * const exporter = new OtlpExporter({
 *   endpoint: 'http://localhost:4318/v1/traces',
 *   serviceName: 'my-api',
 * });
 * exporter.addSpan(span);
 * await exporter.flush();
 * ```
 */
export class OtlpExporter {
  private readonly config: OtlpExporterConfig;
  private readonly fetchFn: typeof fetch;
  private spanBuffer: Span[] = [];
  private metricBuffer: Array<{
    name: string;
    value: number;
    attributes: Record<string, unknown>;
  }> = [];
  private exportCount = 0;
  private lastExportTime = 0;

  constructor(config: OtlpExporterConfig) {
    this.config = config;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  /** Add a completed span to the export buffer */
  /**
   * @param {Span} span
   */
  addSpan(span: Span): void {
    this.spanBuffer.push(span);
    if (this.spanBuffer.length >= (this.config.batchSize ?? 100)) {
      void this.flush();
    }
  }

  /** Add a metric data point to the export buffer */
  /**
   * @param {string} name
   * @param {number} value
   * @param {Object} [attributes]
   */
  addMetric(name: string, value: number, attributes: Record<string, unknown> = {}): void {
    this.metricBuffer.push({ name, value, attributes });
  }

  /** Export all buffered spans to the OTLP endpoint */
  async flush(): Promise<OtlpExportResult> {
    const spans = this.spanBuffer.splice(0);
    const metrics = this.metricBuffer.splice(0);

    if (spans.length === 0 && metrics.length === 0) {
      return { success: true, spanCount: 0, metricCount: 0 };
    }

    const payload = this.buildPayload(spans, metrics);

    try {
      const response = await this.fetchFn(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      });

      this.exportCount++;
      this.lastExportTime = Date.now();

      return {
        success: response.ok,
        spanCount: spans.length,
        metricCount: metrics.length,
        statusCode: response.status,
      };
    } catch (error) {
      // Re-add to buffer for retry
      this.spanBuffer.unshift(...spans);
      this.metricBuffer.unshift(...metrics);
      return {
        success: false,
        spanCount: 0,
        metricCount: 0,
        error: (error as Error).message,
      };
    }
  }

  /** Get current buffer sizes */
  getBufferSize(): { spans: number; metrics: number } {
    return { spans: this.spanBuffer.length, metrics: this.metricBuffer.length };
  }

  /** Get export statistics */
  getStats(): { exportCount: number; lastExportTime: number } {
    return { exportCount: this.exportCount, lastExportTime: this.lastExportTime };
  }

  /** Build the OTLP JSON payload */
  /**
   * @param {Span[]} spans
   * @param {Array<{ name: string; value: number; attributes: Object }>} metrics
   * @returns {OtlpExportPayload}
   */
  buildPayload(
    spans: Span[],
    metrics: Array<{ name: string; value: number; attributes: Record<string, unknown> }>,
  ): OtlpExportPayload {
    const resourceAttrs = this.buildResourceAttributes();
    const payload: OtlpExportPayload = {};

    if (spans.length > 0) {
      payload.resourceSpans = [
        {
          resource: { attributes: resourceAttrs },
          scopeSpans: [
            { scope: { name: "@formwork/otel", version: "1.0.0" }, spans: spans.map(convertSpan) },
          ],
        },
      ];
    }

    if (metrics.length > 0) {
      payload.resourceMetrics = [
        {
          resource: { attributes: resourceAttrs },
          scopeMetrics: [
            {
              scope: { name: "@formwork/otel", version: "1.0.0" },
              metrics: this.groupMetrics(metrics),
            },
          ],
        },
      ];
    }

    return payload;
  }

  /** Build OTLP resource attributes from config */
  private buildResourceAttributes(): OtlpAttribute[] {
    return [
      toOtlpAttribute("service.name", this.config.serviceName ?? "unknown"),
      toOtlpAttribute("service.version", this.config.serviceVersion ?? "0.0.0"),
      ...Object.entries(this.config.resourceAttributes ?? {}).map(([k, v]) =>
        toOtlpAttribute(k, v),
      ),
    ];
  }

  /** Group metric data points by name for OTLP format */
  private groupMetrics(
    metrics: Array<{ name: string; value: number; attributes: Record<string, unknown> }>,
  ): OtlpMetric[] {
    const grouped = new Map<string, typeof metrics>();
    for (const m of metrics) {
      if (!grouped.has(m.name)) grouped.set(m.name, []);
      grouped.get(m.name)?.push(m);
    }
    return [...grouped.entries()].map(([name, points]) => ({
      name,
      data: {
        dataPoints: points.map((p) => ({
          timeUnixNano: toNano(Date.now()),
          asDouble: p.value,
          attributes: Object.entries(p.attributes).map(([k, v]) => toOtlpAttribute(k, v)),
        })),
      },
    }));
  }
}

export interface OtlpExportResult {
  success: boolean;
  spanCount: number;
  metricCount: number;
  statusCode?: number;
  error?: string;
}
