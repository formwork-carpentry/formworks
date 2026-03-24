import { describe, it, expect, beforeEach } from 'vitest';
import { OtlpExporter } from '../src/OtlpExporter.js';
import { Tracer } from '../src/index.js';

describe('otel/OtlpExporter', () => {
  let exporter: OtlpExporter;
  let capturedPayloads: string[];

  beforeEach(() => {
    capturedPayloads = [];
    exporter = new OtlpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      resourceAttributes: { 'deployment.environment': 'test' },
      fetchFn: async (_url, init) => {
        capturedPayloads.push(init?.body as string);
        return new Response('{}', { status: 200 });
      },
    });
  });

  it('exports spans in OTLP payloads', async () => {
    const tracer = new Tracer('test');
    const span = tracer.startSpan('test-operation');
    span.setAttribute('http.method', 'GET');
    span.end();

    exporter.addSpan(span);
    const result = await exporter.flush();

    expect(result.success).toBe(true);
    expect(result.spanCount).toBe(1);

    const payload = JSON.parse(capturedPayloads[0]);
    expect(payload.resourceSpans).toHaveLength(1);
    expect(payload.resourceSpans[0].scopeSpans[0].spans[0].name).toBe('test-operation');
  });

  it('exports metrics and clears buffer on flush', async () => {
    exporter.addMetric('http.request.duration', 42.5, { method: 'GET' });
    exporter.addMetric('http.request.duration', 15.2, { method: 'POST' });
    exporter.addMetric('db.query.count', 100);

    const result = await exporter.flush();
    expect(result.success).toBe(true);
    expect(result.metricCount).toBe(3);
    expect(exporter.getBufferSize()).toEqual({ spans: 0, metrics: 0 });

    const payload = JSON.parse(capturedPayloads[0]);
    expect(payload.resourceMetrics).toHaveLength(1);
    expect(payload.resourceMetrics[0].scopeMetrics[0].metrics.length).toBe(2);
  });

  it('tracks exporter stats and payload structure', async () => {
    const tracer = new Tracer('test');
    const s1 = tracer.startSpan('a');
    s1.end();
    const s2 = tracer.startSpan('b');
    s2.end();

    exporter.addSpan(s1);
    await exporter.flush();
    exporter.addSpan(s2);
    await exporter.flush();

    expect(exporter.getStats().exportCount).toBe(2);
    expect(exporter.getStats().lastExportTime).toBeGreaterThan(0);

    const payload = exporter.buildPayload([s1], [{ name: 'counter', value: 1, attributes: {} }]);
    expect(payload.resourceSpans).toBeDefined();
    expect(payload.resourceMetrics).toBeDefined();
    expect(payload.resourceSpans?.[0].scopeSpans[0].scope.name).toBe('@carpentry/otel');
  });

  it('re-buffers spans on export failure', async () => {
    const failExporter = new OtlpExporter({
      endpoint: 'http://localhost:9999',
      fetchFn: async () => {
        throw new Error('Connection refused');
      },
    });

    const tracer = new Tracer('test');
    const span = tracer.startSpan('op');
    span.end();
    failExporter.addSpan(span);

    const result = await failExporter.flush();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection refused');
    expect(failExporter.getBufferSize().spans).toBe(1);
  });
});
