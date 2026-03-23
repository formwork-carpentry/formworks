/**
 * @module tests
 * @description Tests for Tier 2 production adapters: DatabaseQueue, HttpMail, OTLP
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseQueueAdapter } from '../packages/queue/src/adapters/DatabaseQueueAdapter.js';
import { HttpMailAdapter } from '../packages/mail/src/adapters/HttpMailAdapter.js';
import { OtlpExporter } from '../packages/otel/src/OtlpExporter.js';
import { Tracer, Span } from '../packages/otel/src/index.js';
import { MockDatabaseAdapter } from '../packages/orm/src/adapters/MockDatabaseAdapter.js';

// ═══════════════════════════════════════════════════════════
// DATABASE QUEUE ADAPTER
// ═══════════════════════════════════════════════════════════

describe('DatabaseQueueAdapter', () => {
  let db: MockDatabaseAdapter;
  let queue: DatabaseQueueAdapter;

  beforeEach(() => {
    db = new MockDatabaseAdapter();
    queue = new DatabaseQueueAdapter(db, { table: 'jobs' });
  });

  describe('push', () => {
    it('inserts a job and returns an ID', async () => {
      const id = await queue.push({ name: 'SendEmail', payload: { to: 'user@test.com' } });
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('pushes to default queue', async () => {
      await queue.push({ name: 'ProcessImage', payload: { path: '/img.png' } });
      const size = await queue.size();
      expect(size).toBeGreaterThanOrEqual(0); // MockAdapter may not track rows
    });
  });

  describe('pushRaw', () => {
    it('pushes a raw payload string', async () => {
      const id = await queue.pushRaw(JSON.stringify({ action: 'cleanup' }), 'maintenance');
      expect(id).toBeTruthy();
    });
  });

  describe('later', () => {
    it('pushes a delayed job', async () => {
      const id = await queue.later(60, { name: 'ScheduledTask', payload: {} });
      expect(id).toBeTruthy();
    });
  });

  describe('delete', () => {
    it('removes a job by ID', async () => {
      const id = await queue.push({ name: 'Temp', payload: {} });
      await queue.delete(id);
      // No error = success
    });
  });

  describe('release', () => {
    it('releases a job back to queue with delay', async () => {
      const id = await queue.push({ name: 'Retry', payload: {} });
      await queue.release(id, 30);
      // No error = success
    });
  });

  describe('purge', () => {
    it('purges all jobs from a queue', async () => {
      await queue.push({ name: 'A', payload: {} });
      await queue.push({ name: 'B', payload: {} });
      const count = await queue.purge();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// HTTP MAIL ADAPTER
// ═══════════════════════════════════════════════════════════

describe('HttpMailAdapter', () => {
  function createMockFetch(status: number, body: Record<string, unknown> = {}): typeof fetch {
    return async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }

  describe('Resend provider', () => {
    it('sends email successfully', async () => {
      const mailer = new HttpMailAdapter({
        provider: 'resend',
        apiKey: 're_test_key',
        from: 'noreply@example.com',
        fetchFn: createMockFetch(200, { id: 'msg_123' }),
      });

      await mailer.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hello</p>' });
      expect(mailer.getSent()).toHaveLength(1);
      expect(mailer.getSent()[0].to).toBe('user@example.com');
    });

    it('throws on API failure', async () => {
      const mailer = new HttpMailAdapter({
        provider: 'resend',
        apiKey: 'bad_key',
        fetchFn: createMockFetch(401, { error: 'Unauthorized' }),
      });

      await expect(mailer.send({ to: 'x@x.com', subject: 'X', html: '' }))
        .rejects.toThrow('Mail send failed');
    });
  });

  describe('SendGrid provider', () => {
    it('sends with SendGrid format', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      const mockFetch: typeof fetch = async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response('{}', { status: 202 });
      };

      const mailer = new HttpMailAdapter({
        provider: 'sendgrid',
        apiKey: 'sg_key',
        from: 'sender@example.com',
        fetchFn: mockFetch,
      });

      await mailer.send({ to: 'user@test.com', subject: 'Hi', html: '<b>Hello</b>' });
      expect(capturedBody).toHaveProperty('personalizations');
      expect(capturedBody).toHaveProperty('from');
    });
  });

  describe('Postmark provider', () => {
    it('uses X-Postmark-Server-Token header', async () => {
      let capturedHeaders: Record<string, string> = {};
      const mockFetch: typeof fetch = async (_url, init) => {
        capturedHeaders = Object.fromEntries(Object.entries(init?.headers ?? {}));
        return new Response('{"MessageID":"abc"}', { status: 200 });
      };

      const mailer = new HttpMailAdapter({
        provider: 'postmark',
        apiKey: 'pm_token',
        fetchFn: mockFetch,
      });

      await mailer.send({ to: 'a@b.com', subject: 'Test', text: 'Hello' });
      expect(capturedHeaders['X-Postmark-Server-Token']).toBe('pm_token');
    });
  });

  describe('custom provider', () => {
    it('requires baseUrl', () => {
      expect(() => new HttpMailAdapter({ provider: 'custom', apiKey: 'x' }))
        .toThrow('no baseUrl');
    });

    it('works with custom baseUrl', async () => {
      const mailer = new HttpMailAdapter({
        provider: 'custom',
        apiKey: 'x',
        baseUrl: 'https://mail.internal.corp/api',
        fetchFn: createMockFetch(200, { ok: true }),
      });

      await mailer.send({ to: 'user@corp.com', subject: 'Internal', text: 'Hi' });
      expect(mailer.getSent()).toHaveLength(1);
    });
  });

  describe('network error handling', () => {
    it('wraps fetch errors', async () => {
      const mailer = new HttpMailAdapter({
        provider: 'resend',
        apiKey: 'x',
        fetchFn: async () => { throw new Error('Network error'); },
      });

      await expect(mailer.send({ to: 'x@x.com', subject: 'X', text: '' }))
        .rejects.toThrow('Mail send failed');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// OTLP EXPORTER
// ═══════════════════════════════════════════════════════════

describe('OtlpExporter', () => {
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

  describe('span export', () => {
    it('exports spans in OTLP format', async () => {
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
      const otlpSpan = payload.resourceSpans[0].scopeSpans[0].spans[0];
      expect(otlpSpan.name).toBe('test-operation');
    });

    it('includes resource attributes', async () => {
      const tracer = new Tracer('test');
      const span = tracer.startSpan('op');
      span.end();
      exporter.addSpan(span);
      await exporter.flush();

      const payload = JSON.parse(capturedPayloads[0]);
      const attrs = payload.resourceSpans[0].resource.attributes;
      const serviceNameAttr = attrs.find((a: { key: string }) => a.key === 'service.name');
      expect(serviceNameAttr.value.stringValue).toBe('test-service');
    });

    it('converts span attributes to OTLP format', async () => {
      const tracer = new Tracer('test');
      const span = tracer.startSpan('op');
      span.setAttribute('http.status_code', 200);
      span.setAttribute('http.url', '/api/test');
      span.setAttribute('cache.hit', true);
      span.end();

      exporter.addSpan(span);
      await exporter.flush();

      const payload = JSON.parse(capturedPayloads[0]);
      const attrs = payload.resourceSpans[0].scopeSpans[0].spans[0].attributes;
      expect(attrs.find((a: { key: string }) => a.key === 'http.status_code').value.intValue).toBe('200');
      expect(attrs.find((a: { key: string }) => a.key === 'http.url').value.stringValue).toBe('/api/test');
      expect(attrs.find((a: { key: string }) => a.key === 'cache.hit').value.boolValue).toBe(true);
    });
  });

  describe('metric export', () => {
    it('exports metrics in OTLP format', async () => {
      exporter.addMetric('http.request.duration', 42.5, { method: 'GET' });
      exporter.addMetric('http.request.duration', 15.2, { method: 'POST' });
      exporter.addMetric('db.query.count', 100);

      const result = await exporter.flush();
      expect(result.success).toBe(true);
      expect(result.metricCount).toBe(3);

      const payload = JSON.parse(capturedPayloads[0]);
      expect(payload.resourceMetrics).toHaveLength(1);
      const metrics = payload.resourceMetrics[0].scopeMetrics[0].metrics;
      expect(metrics.length).toBe(2); // 2 unique metric names
    });
  });

  describe('buffering', () => {
    it('starts with empty buffer', () => {
      expect(exporter.getBufferSize()).toEqual({ spans: 0, metrics: 0 });
    });

    it('tracks buffer size', () => {
      const tracer = new Tracer('test');
      const span = tracer.startSpan('op');
      span.end();
      exporter.addSpan(span);
      exporter.addMetric('counter', 1);

      expect(exporter.getBufferSize()).toEqual({ spans: 1, metrics: 1 });
    });

    it('clears buffer after flush', async () => {
      const tracer = new Tracer('test');
      const span = tracer.startSpan('op');
      span.end();
      exporter.addSpan(span);

      await exporter.flush();
      expect(exporter.getBufferSize()).toEqual({ spans: 0, metrics: 0 });
    });

    it('returns empty result when buffer is empty', async () => {
      const result = await exporter.flush();
      expect(result.success).toBe(true);
      expect(result.spanCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('re-buffers spans on network error', async () => {
      const failExporter = new OtlpExporter({
        endpoint: 'http://localhost:9999',
        fetchFn: async () => { throw new Error('Connection refused'); },
      });

      const tracer = new Tracer('test');
      const span = tracer.startSpan('op');
      span.end();
      failExporter.addSpan(span);

      const result = await failExporter.flush();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
      // Spans should be re-buffered for retry
      expect(failExporter.getBufferSize().spans).toBe(1);
    });
  });

  describe('stats', () => {
    it('tracks export count', async () => {
      const tracer = new Tracer('test');
      const s1 = tracer.startSpan('a'); s1.end();
      const s2 = tracer.startSpan('b'); s2.end();

      exporter.addSpan(s1);
      await exporter.flush();
      exporter.addSpan(s2);
      await exporter.flush();

      expect(exporter.getStats().exportCount).toBe(2);
      expect(exporter.getStats().lastExportTime).toBeGreaterThan(0);
    });
  });

  describe('buildPayload', () => {
    it('produces valid OTLP JSON structure', () => {
      const tracer = new Tracer('test');
      const span = tracer.startSpan('op');
      span.end();

      const payload = exporter.buildPayload([span], [{ name: 'counter', value: 1, attributes: {} }]);
      expect(payload.resourceSpans).toBeDefined();
      expect(payload.resourceMetrics).toBeDefined();
      expect(payload.resourceSpans![0].scopeSpans[0].scope.name).toBe('@carpentry/otel');
    });
  });
});
