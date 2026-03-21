import { describe, it, expect, beforeEach } from 'vitest';
import { Tracer, Span, Counter, Histogram, Gauge, MetricsRegistry } from '../src/index.js';

describe('@formwork/otel: Span', () => {
  it('records attributes', () => {
    const span = new Span('test', 'trace-1', 'span-1');
    span.setAttribute('http.method', 'GET').setAttribute('http.url', '/users');
    expect(span.attributes['http.method']).toBe('GET');
  });

  it('records events', () => {
    const span = new Span('test', 'trace-1', 'span-1');
    span.addEvent('cache.miss', { key: 'user:1' });
    expect(span.events).toHaveLength(1);
    expect(span.events[0].name).toBe('cache.miss');
  });

  it('tracks duration', () => {
    const span = new Span('test', 'trace-1', 'span-1');
    span.end();
    expect(span.duration()).toBeGreaterThanOrEqual(0);
    expect(span.isEnded()).toBe(true);
  });

  it('end() is idempotent', () => {
    const span = new Span('test', 'trace-1', 'span-1');
    span.end();
    const endTime = span.endTime;
    span.end();
    expect(span.endTime).toBe(endTime);
  });
});

describe('@formwork/otel: Tracer', () => {
  let tracer: Tracer;
  beforeEach(() => { tracer = new Tracer(); });

  it('startSpan() creates a span', () => {
    const span = tracer.startSpan('http.request');
    expect(span.name).toBe('http.request');
    expect(span.traceId).toBeDefined();
    expect(span.spanId).toBeDefined();
  });

  it('child spans share traceId', () => {
    const parent = tracer.startSpan('parent');
    const child = tracer.startSpan('child', parent);
    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
  });

  it('trace() wraps function with span lifecycle', async () => {
    const result = await tracer.trace('db.query', async (span) => {
      span.setAttribute('db.table', 'users');
      return 42;
    });

    expect(result).toBe(42);
    tracer.assertSpanExists('db.query');
    tracer.assertSpanStatus('db.query', 'ok');
    expect(tracer.getSpans()[0].isEnded()).toBe(true);
  });

  it('trace() records errors', async () => {
    await expect(tracer.trace('failing', async () => {
      throw new Error('db down');
    })).rejects.toThrow('db down');

    tracer.assertSpanStatus('failing', 'error');
    expect(tracer.getSpans()[0].attributes['error.message']).toBe('db down');
  });

  it('getTrace() returns spans for a trace', () => {
    const parent = tracer.startSpan('parent');
    tracer.startSpan('child1', parent);
    tracer.startSpan('child2', parent);
    tracer.startSpan('unrelated');

    const trace = tracer.getTrace(parent.traceId);
    expect(trace).toHaveLength(3);
  });

  it('assertSpanCount()', () => {
    tracer.startSpan('a');
    tracer.startSpan('b');
    tracer.assertSpanCount(2);
  });

  it('reset()', () => {
    tracer.startSpan('a');
    tracer.reset();
    tracer.assertSpanCount(0);
  });
});

describe('@formwork/otel: Counter', () => {
  it('increments', () => {
    const c = new Counter('requests');
    c.add();
    c.add(5);
    expect(c.getValue()).toBe(6);
  });

  it('reset()', () => {
    const c = new Counter('x');
    c.add(10);
    c.reset();
    expect(c.getValue()).toBe(0);
  });
});

describe('@formwork/otel: Histogram', () => {
  let h: Histogram;
  beforeEach(() => { h = new Histogram('latency'); });

  it('records and computes stats', () => {
    h.record(10); h.record(20); h.record(30); h.record(40); h.record(50);
    expect(h.count()).toBe(5);
    expect(h.sum()).toBe(150);
    expect(h.min()).toBe(10);
    expect(h.max()).toBe(50);
    expect(h.avg()).toBe(30);
  });

  it('percentile()', () => {
    for (let i = 1; i <= 100; i++) h.record(i);
    expect(h.percentile(50)).toBe(50);
    expect(h.percentile(95)).toBe(95);
    expect(h.percentile(99)).toBe(99);
  });
});

describe('@formwork/otel: Gauge', () => {
  it('set/increment/decrement', () => {
    const g = new Gauge('connections');
    g.set(10);
    expect(g.getValue()).toBe(10);
    g.increment(5);
    expect(g.getValue()).toBe(15);
    g.decrement(3);
    expect(g.getValue()).toBe(12);
  });
});

describe('@formwork/otel: MetricsRegistry', () => {
  let registry: MetricsRegistry;
  beforeEach(() => { registry = new MetricsRegistry(); });

  it('creates and retrieves counters', () => {
    const c = registry.counter('http.requests');
    c.add();
    expect(registry.counter('http.requests').getValue()).toBe(1);
  });

  it('creates and retrieves histograms', () => {
    registry.histogram('http.duration').record(150);
    expect(registry.histogram('http.duration').count()).toBe(1);
  });

  it('creates and retrieves gauges', () => {
    registry.gauge('db.connections').set(5);
    expect(registry.gauge('db.connections').getValue()).toBe(5);
  });

  it('same name returns same instance', () => {
    const a = registry.counter('x');
    const b = registry.counter('x');
    expect(a).toBe(b);
  });
});
