/**
 * @module @carpentry/queue-bullmq
 * @description Mock BullMQ Queue for testing — no Redis needed.
 *
 * @example
 * ```ts
 * import { BullMqAdapter, MockBullMqQueue } from '@carpentry/queue-bullmq';
 * const mockQueue = new MockBullMqQueue();
 * const adapter = new BullMqAdapter(mockQueue);
 * await adapter.push({ name: 'Test', payload: {} });
 * expect(mockQueue.getJobs()).toHaveLength(1);
 * ```
 */

import type { IBullMqQueue } from './types.js';

/** In-memory mock that implements the IBullMqQueue interface for testing. */
export class MockBullMqQueue implements IBullMqQueue {
  private jobs: Array<{ id: string; name: string; data: unknown; opts: Record<string, unknown> }> = [];
  private idCounter = 0;

  async add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }> {
    const id = `mock_${++this.idCounter}`;
    this.jobs.push({ id, name, data, opts: opts ?? {} });
    return { id };
  }

  async getJobCounts(): Promise<Record<string, number>> {
    return { waiting: this.jobs.length, active: 0, delayed: 0, completed: 0, failed: 0 };
  }

  async obliterate(): Promise<void> { this.jobs = []; }
  async close(): Promise<void> {}

  /** Test helper: get all queued jobs */
  getJobs() { return [...this.jobs]; }
  /** Test helper: clear jobs */
  clear() { this.jobs = []; }
}
