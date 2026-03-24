import { describe, it, expect, beforeEach } from 'vitest';
import { BullMqAdapter, MockBullMqQueue } from '../../../packages/queue-bullmq/src/index.js';

describe('packages/queue/BullMqAdapter', () => {
  let mockQueue: MockBullMqQueue;
  let adapter: BullMqAdapter;

  beforeEach(() => {
    mockQueue = new MockBullMqQueue();
    adapter = new BullMqAdapter(mockQueue, { queueName: 'emails' });
  });

  it('pushes and delays jobs', async () => {
    const id = await adapter.push({ name: 'SendEmail', payload: { to: 'user@test.com' } });
    expect(id).toContain('mock_');

    const delayedId = await adapter.later(30, { name: 'Reminder', payload: {} });
    expect(delayedId).toBeTruthy();

    const jobs = mockQueue.getJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs[1].opts['delay']).toBe(30000);
  });

  it('supports pushRaw, size, purge and queue metadata', async () => {
    await adapter.pushRaw(JSON.stringify({ action: 'cleanup' }));
    await adapter.push({ name: 'Retry', payload: {}, maxTries: 5 });

    expect(await adapter.size()).toBe(2);
    expect(mockQueue.getJobs()[1].opts['attempts']).toBe(5);
    expect(await adapter.pop()).toBeNull();
    expect(adapter.getQueueName()).toBe('emails');

    await adapter.purge();
    expect(mockQueue.getJobs()).toHaveLength(0);
  });
});
