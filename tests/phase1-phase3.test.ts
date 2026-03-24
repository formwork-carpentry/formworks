/**
 * @module tests
 * @description Tests for Phase 1+3 buildable items: form helpers, profiler, AI streaming.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════
// FORM HELPERS (CARP-042)
// ═══════════════════════════════════════════════════════════

import { useForm } from '../src/ui/FormHelper.js';

function mockFetch(status: number, body: Record<string, unknown>): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('useForm', () => {
  it('initializes with data', () => {
    const form = useForm({ name: '', email: '' });
    expect(form.data.name).toBe('');
    expect(form.processing).toBe(false);
    expect(form.hasErrors).toBe(false);
  });

  it('tracks dirty state', () => {
    const form = useForm({ name: 'Alice' });
    expect(form.isDirty).toBe(false);
    form.data.name = 'Bob';
    expect(form.isDirty).toBe(true);
  });

  it('submits POST and handles success', async () => {
    const form = useForm({ title: 'Hello' });
    let successData: unknown;

    const result = await form.post('/api/posts', {
      fetchFn: mockFetch(201, { data: { id: 1 } }),
      onSuccess: (d) => { successData = d; },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(successData).toEqual({ data: { id: 1 } });
    expect(form.recentlySuccessful).toBe(true);
  });

  it('handles 422 validation errors', async () => {
    const form = useForm({ email: 'bad' });
    let errorsCaptured: Record<string, string[]> = {};

    const result = await form.post('/api/register', {
      fetchFn: mockFetch(422, { errors: { email: ['Invalid email format'] } }),
      onError: (e) => { errorsCaptured = e; },
    });

    expect(result.ok).toBe(false);
    expect(form.hasErrors).toBe(true);
    expect(form.errors['email']).toEqual(['Invalid email format']);
    expect(errorsCaptured['email']).toEqual(['Invalid email format']);
  });

  it('tracks processing state', async () => {
    const form = useForm({ x: 1 });
    const states: boolean[] = [];
    form.onChange((f) => states.push(f.processing));

    await form.post('/api/test', { fetchFn: mockFetch(200, {}) });

    expect(states).toContain(true);  // Was processing during request
    expect(form.processing).toBe(false);  // Finished
  });

  it('resets to initial values', async () => {
    const form = useForm({ name: 'Alice', email: 'alice@test.com' });
    form.data.name = 'Bob';
    form.setError('name', 'Too short');

    form.reset();

    expect(form.data.name).toBe('Alice');
    expect(form.hasErrors).toBe(false);
    expect(form.isDirty).toBe(false);
  });

  it('clears specific field errors', () => {
    const form = useForm({ a: '', b: '' });
    form.setError('a', 'Required');
    form.setError('b', 'Required');
    form.clearError('a');
    expect(form.errors['a']).toBeUndefined();
    expect(form.errors['b']).toEqual(['Required']);
  });

  it('transforms data before submission', async () => {
    const form = useForm({ name: 'alice', age: '25' });
    let sentBody: unknown;

    const fakeFetch: typeof fetch = async (_url, init) => {
      sentBody = JSON.parse(init?.body as string);
      return new Response('{}', { status: 200 });
    };

    form.transform((data) => ({ ...data, name: data.name.toUpperCase(), age: Number(data.age) }));
    await form.post('/api/users', { fetchFn: fakeFetch });

    expect(sentBody).toEqual({ name: 'ALICE', age: 25 });
  });

  it('supports PUT, PATCH, DELETE', async () => {
    const form = useForm({ id: 1 });
    const methods: string[] = [];
    const fakeFetch: typeof fetch = async (_url, init) => {
      methods.push(init?.method ?? 'GET');
      return new Response('{}', { status: 200 });
    };

    await form.put('/api/x', { fetchFn: fakeFetch });
    await form.patch('/api/x', { fetchFn: fakeFetch });
    await form.delete('/api/x', { fetchFn: fakeFetch });

    expect(methods).toEqual(['PUT', 'PATCH', 'DELETE']);
  });
});

// ═══════════════════════════════════════════════════════════
// PROFILER (CARP-063)
// ═══════════════════════════════════════════════════════════

import { Profiler, ProfileCollector } from '../src/http/middleware/Profiler.js';

describe('ProfileCollector', () => {
  it('records events', () => {
    const c = new ProfileCollector();
    c.record('query', 'SELECT * FROM users', 2.5, { rows: 10 });
    c.record('cache', 'GET user:42', 0.1, { hit: true });
    c.record('cache', 'GET user:99', 0.2, { hit: false });

    expect(c.getEvents()).toHaveLength(3);
    expect(c.getQueryCount()).toBe(1);
    expect(c.getCacheHits()).toBe(1);
    expect(c.getCacheMisses()).toBe(1);
    expect(c.getTotalQueryTime()).toBe(2.5);
  });
});

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => { profiler = new Profiler({ maxProfiles: 5 }); });

  it('records and stores request profiles', () => {
    const collector = profiler.startRequest();
    collector.record('query', 'SELECT 1', 1.0);
    const profile = profiler.finishRequest(collector, 'GET', '/api/users', 200, 12.5);

    expect(profile.method).toBe('GET');
    expect(profile.path).toBe('/api/users');
    expect(profile.totalMs).toBe(12.5);
    expect(profile.events).toHaveLength(1);
  });

  it('generates debug headers', () => {
    const collector = profiler.startRequest();
    collector.record('query', 'SELECT * FROM posts', 3.2);
    collector.record('query', 'SELECT * FROM users', 1.8);
    collector.record('cache', 'GET posts:all', 0.1, { hit: true });
    const profile = profiler.finishRequest(collector, 'GET', '/api/posts', 200, 15.0);

    const headers = profiler.getDebugHeaders(profile);
    expect(headers['X-Debug-Time']).toBe('15.0ms');
    expect(headers['X-Debug-Queries']).toContain('2');
    expect(headers['X-Debug-Cache']).toContain('1 hits');
    expect(headers['X-Debug-Request-Id']).toBeDefined();
  });

  it('limits stored profiles', () => {
    for (let i = 0; i < 10; i++) {
      const c = profiler.startRequest();
      profiler.finishRequest(c, 'GET', `/path/${i}`, 200, i);
    }
    expect(profiler.getRecentProfiles(20)).toHaveLength(5); // maxProfiles: 5
  });

  it('computes aggregate stats', () => {
    for (let i = 1; i <= 3; i++) {
      const c = profiler.startRequest();
      c.record('query', 'Q', i * 2);
      profiler.finishRequest(c, 'GET', '/', 200, i * 10);
    }
    const stats = profiler.getStats();
    expect(stats.totalRequests).toBe(3);
    expect(stats.avgMs).toBe(20); // (10+20+30)/3
  });
});

// ═══════════════════════════════════════════════════════════
// AI STREAMING (CARP-079)
// ═══════════════════════════════════════════════════════════

import { parseSSE, streamCompletion, useStream } from '../packages/ai/src/streaming.js';
import type { StreamChunk } from '../packages/ai/src/streaming.js';

function makeSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event + '\n\n'));
      }
      controller.close();
    },
  });
}

describe('parseSSE', () => {
  it('parses SSE events from a stream', async () => {
    const stream = makeSSEStream([
      'data: {"text":"hello"}',
      'data: {"text":"world"}',
      'data: [DONE]',
    ]);

    const events: string[] = [];
    for await (const event of parseSSE(stream)) {
      events.push(event.data);
    }

    expect(events).toEqual(['{"text":"hello"}', '{"text":"world"}']);
  });

  it('handles event types', async () => {
    const stream = makeSSEStream([
      'event: delta\ndata: {"content":"hi"}',
    ]);

    const events = [];
    for await (const event of parseSSE(stream)) events.push(event);
    expect(events[0].event).toBe('delta');
  });
});

describe('streamCompletion', () => {
  it('falls back to complete() for non-streaming providers', async () => {
    const mockProvider = {
      getProviderName: () => 'mock',
      complete: async () => ({
        content: 'Full response', model: 'mock',
        usage: { inputTokens: 5, outputTokens: 10 },
        finishReason: 'stop', provider: 'mock',
      }),
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of streamCompletion(mockProvider, [{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Full response');
    expect(chunks[0].done).toBe(true);
    expect(chunks[0].usage?.outputTokens).toBe(10);
  });
});

describe('useStream', () => {
  it('creates a stream state object', () => {
    const stream = useStream('/api/chat', { message: 'Hello' });
    expect(stream.fullText).toBe('');
    expect(stream.streaming).toBe(false);
    expect(stream.done).toBe(false);
  });

  it('supports chained callbacks', () => {
    const stream = useStream('/api/chat', { message: 'Hi' });
    const result = stream.onChunk(() => {}).onDone(() => {}).onError(() => {});
    expect(result).toBe(stream); // Chainable
  });
});
