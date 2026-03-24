import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SqsQueueAdapter } from '../src/index.js';

describe('@carpentry/queue-sqs: SqsQueueAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes and pops jobs from default queue url', async () => {
    const queue = new SqsQueueAdapter({ queueUrl: 'https://sqs.local/default' });

    const jobId = await queue.push({ name: 'SendEmail', payload: { to: 'a@b.com' } });
    expect(jobId).toContain('sqs-');
    expect(await queue.size()).toBe(1);

    const popped = await queue.pop();
    expect(popped?.name).toBe('SendEmail');
    expect(await queue.size()).toBe(0);
  });

  it('supports delayed jobs and clear', async () => {
    const queue = new SqsQueueAdapter({ queueUrl: 'https://sqs.local/default' });

    await queue.later(5, { name: 'Delayed', payload: { value: 1 } });
    expect(await queue.pop()).toBeNull();

    vi.advanceTimersByTime(5_000);
    expect((await queue.pop())?.name).toBe('Delayed');

    await queue.push({ name: 'A', payload: {} });
    await queue.push({ name: 'B', payload: {} });
    expect(await queue.size()).toBe(2);

    await queue.clear();
    expect(await queue.size()).toBe(0);
  });

  it('parses pushRaw payloads', async () => {
    const queue = new SqsQueueAdapter({ queueUrl: 'https://sqs.local/default' });

    await queue.pushRaw(JSON.stringify({ name: 'RawJob', payload: { ok: true } }));
    const popped = await queue.pop();

    expect(popped?.name).toBe('RawJob');
    expect(popped?.payload).toEqual({ ok: true });
  });
});
