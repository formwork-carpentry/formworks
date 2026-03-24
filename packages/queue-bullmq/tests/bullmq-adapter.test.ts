import { describe, it, expect, beforeEach } from 'vitest';
import { BullMqAdapter, MockBullMqQueue } from '../src/index.js';

describe('BullMqAdapter', () => {
  let mockQueue: MockBullMqQueue;
  let adapter: BullMqAdapter;

  beforeEach(() => {
    mockQueue = new MockBullMqQueue();
    adapter = new BullMqAdapter(mockQueue, { queueName: 'test-queue' });
  });

  it('should push a job to the queue', async () => {
    const id = await adapter.push({ name: 'SendEmail', payload: { to: 'user@test.com' } });
    expect(id).toMatch(/^mock_/);
    expect(mockQueue.getJobs()).toHaveLength(1);
    expect(mockQueue.getJobs()[0].name).toBe('SendEmail');
  });

  it('should push raw payload', async () => {
    const id = await adapter.pushRaw('{"custom":"data"}');
    expect(id).toMatch(/^mock_/);
    expect(mockQueue.getJobs()[0].name).toBe('raw');
  });

  it('should push delayed job', async () => {
    const id = await adapter.later(30, { name: 'Delayed', payload: {} });
    expect(id).toMatch(/^mock_/);
    const job = mockQueue.getJobs()[0];
    expect(job.opts).toHaveProperty('delay', 30000);
  });

  it('should return queue size', async () => {
    await adapter.push({ name: 'A', payload: {} });
    await adapter.push({ name: 'B', payload: {} });
    const size = await adapter.size();
    expect(size).toBe(2);
  });

  it('should return null for pop (BullMQ uses workers)', async () => {
    expect(await adapter.pop()).toBeNull();
  });

  it('should purge the queue', async () => {
    await adapter.push({ name: 'A', payload: {} });
    await adapter.purge();
    expect(mockQueue.getJobs()).toHaveLength(0);
  });

  it('should close without error', async () => {
    await expect(adapter.close()).resolves.toBeUndefined();
  });

  it('should return the queue name', () => {
    expect(adapter.getQueueName()).toBe('test-queue');
  });

  it('should use default queue name', () => {
    const defaultAdapter = new BullMqAdapter(mockQueue);
    expect(defaultAdapter.getQueueName()).toBe('default');
  });
});
