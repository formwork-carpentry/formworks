import { describe, it, expect } from 'vitest';
import { parseSSE, streamCompletion, useStream } from '../src/streaming.js';
import type { StreamChunk } from '../src/streaming.js';

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

describe('ai/parseSSE', () => {
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
    const stream = makeSSEStream(['event: delta\ndata: {"content":"hi"}']);

    const events = [];
    for await (const event of parseSSE(stream)) events.push(event);
    expect(events[0].event).toBe('delta');
  });
});

describe('ai/streamCompletion', () => {
  it('falls back to complete() for non-streaming providers', async () => {
    const mockProvider = {
      getProviderName: () => 'mock',
      complete: async () => ({
        content: 'Full response',
        model: 'mock',
        usage: { inputTokens: 5, outputTokens: 10 },
        finishReason: 'stop',
        provider: 'mock',
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

describe('ai/useStream', () => {
  it('creates a stream state object', () => {
    const stream = useStream('/api/chat', { message: 'Hello' });
    expect(stream.fullText).toBe('');
    expect(stream.streaming).toBe(false);
    expect(stream.done).toBe(false);
  });

  it('supports chained callbacks', () => {
    const stream = useStream('/api/chat', { message: 'Hi' });
    const result = stream.onChunk(() => {}).onDone(() => {}).onError(() => {});
    expect(result).toBe(stream);
  });
});
