import { describe, it, expect, beforeEach } from 'vitest';
import { MockAIProvider, InMemoryVectorStore, setAIProvider, AI } from '../src/index.js';

describe('@formwork/ai: MockAIProvider', () => {
  let ai: MockAIProvider;

  beforeEach(() => { ai = new MockAIProvider(); });

  it('returns queued response', async () => {
    ai.queueResponse('Hello from AI');
    const result = await ai.complete([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Hello from AI');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it('returns default response when queue empty', async () => {
    const result = await ai.complete([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Mock response');
  });

  it('logs all completion calls', async () => {
    await ai.complete([{ role: 'system', content: 'You are helpful.' }, { role: 'user', content: 'hi' }]);
    await ai.complete([{ role: 'user', content: 'bye' }]);

    ai.assertCalledTimes(2);
    const log = ai.getLog();
    expect(log[0].messages).toHaveLength(2);
    expect(log[1].messages).toHaveLength(1);
  });

  it('assertSystemMessage()', async () => {
    await ai.complete([{ role: 'system', content: 'Be concise.' }, { role: 'user', content: 'hi' }]);
    ai.assertSystemMessage('Be concise');
  });

  it('assertSystemMessage() throws when missing', async () => {
    await ai.complete([{ role: 'user', content: 'hi' }]);
    expect(() => ai.assertSystemMessage('system prompt')).toThrow();
  });

  it('stream() yields chunks', async () => {
    ai.queueResponse('Hello World');
    const chunks: string[] = [];
    for await (const chunk of ai.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk.content);
    }
    expect(chunks.join('')).toContain('Hello');
    expect(chunks[chunks.length - 1]).toBe('');
  });

  it('reset() clears state', async () => {
    ai.queueResponse('a');
    await ai.complete([{ role: 'user', content: 'hi' }]);
    ai.reset();
    ai.assertCalledTimes(0);
  });
});

describe('@formwork/ai: InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  beforeEach(() => { store = new InMemoryVectorStore(); });

  it('upsert and search', async () => {
    await store.upsert('doc1', 'Hello world', [1, 0, 0]);
    await store.upsert('doc2', 'Goodbye world', [0, 1, 0]);
    await store.upsert('doc3', 'Hello again', [0.9, 0.1, 0]);

    const results = await store.search([1, 0, 0], 2);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('doc1'); // most similar
    expect(results[0].score).toBeCloseTo(1.0);
  });

  it('upsert replaces existing document', async () => {
    await store.upsert('doc1', 'original', [1, 0]);
    await store.upsert('doc1', 'updated', [0, 1]);
    expect(store.count()).toBe(1);

    const results = await store.search([0, 1], 1);
    expect(results[0].content).toBe('updated');
  });

  it('delete removes document', async () => {
    await store.upsert('doc1', 'hello', [1, 0]);
    await store.delete('doc1');
    expect(store.count()).toBe(0);
  });

  it('stores metadata', async () => {
    await store.upsert('doc1', 'hello', [1], { source: 'test' });
    const results = await store.search([1], 1);
    expect(results[0].metadata).toEqual({ source: 'test' });
  });
});

describe('@formwork/ai: AI Facade', () => {
  beforeEach(() => {
    const provider = new MockAIProvider();
    provider.queueResponse('Facade response');
    setAIProvider(provider);
  });

  it('AI.complete()', async () => {
    const result = await AI.complete([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Facade response');
  });

  it('AI.ask() shorthand', async () => {
    const provider = new MockAIProvider();
    provider.queueResponse('42');
    setAIProvider(provider);

    const answer = await AI.ask('What is 6 * 7?');
    expect(answer).toBe('42');
  });
});
