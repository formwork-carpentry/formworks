import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseQueueAdapter } from '../src/index.js';

describe('@carpentry/queue-database: DatabaseQueueAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes and pops immediate jobs in FIFO order', async () => {
    const queue = new DatabaseQueueAdapter({ table: 'jobs_test_fifo', queue: 'default' });

    await queue.push({ name: 'A', payload: { id: 1 } });
    await queue.push({ name: 'B', payload: { id: 2 } });

    expect(await queue.size()).toBe(2);

    const first = await queue.pop();
    const second = await queue.pop();
    const third = await queue.pop();

    expect(first?.name).toBe('A');
    expect(second?.name).toBe('B');
    expect(third).toBeNull();
  });

  it('respects delayed jobs from later()', async () => {
    const queue = new DatabaseQueueAdapter({ table: 'jobs_test_delay', queue: 'emails' });

    await queue.later(10, { name: 'SendReminder', payload: { id: 42 }, queue: 'emails' });

    expect(await queue.pop('emails')).toBeNull();

    vi.advanceTimersByTime(9_000);
    expect(await queue.pop('emails')).toBeNull();

    vi.advanceTimersByTime(1_000);
    const ready = await queue.pop('emails');
    expect(ready?.name).toBe('SendReminder');
  });

  it('supports pushRaw and clear', async () => {
    const queue = new DatabaseQueueAdapter({ table: 'jobs_test_raw', queue: 'raw' });

    await queue.pushRaw(JSON.stringify({ name: 'RawJob', payload: { ok: true } }));
    expect(await queue.size('raw')).toBe(1);

    const job = await queue.pop('raw');
    expect(job?.name).toBe('RawJob');

    await queue.push({ name: 'ToClear', payload: {} });
    expect(await queue.size('raw')).toBe(1);

    await queue.clear('raw');
    expect(await queue.size('raw')).toBe(0);
  });
});
