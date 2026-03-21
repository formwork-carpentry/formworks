/**
 * @module @formwork/queue-bullmq
 * @description BullMqAdapter — production queue adapter backed by Redis via BullMQ.
 *
 * Wraps BullMQ's Queue with the IQueueAdapter interface. Jobs are serialized to JSON,
 * stored in Redis, and processed by workers on separate processes/machines.
 *
 * @patterns Adapter (BullMQ → IQueueAdapter), Producer-Consumer
 * @principles LSP (substitutable for SyncQueue/MemoryQueue), SRP (BullMQ operations only)
 *
 * @example
 * ```ts
 * import { BullMqAdapter, MockBullMqQueue } from '@formwork/queue-bullmq';
 *
 * const mockQueue = new MockBullMqQueue();
 * const adapter = new BullMqAdapter(mockQueue);
 * await adapter.push({ name: 'SendWelcome', payload: { userId: 42 } });
 * ```
 */

import type { IQueueAdapter, QueuedJob } from '@formwork/core/contracts';
import type { IBullMqQueue, BullMqAdapterConfig } from './types.js';

export { type IBullMqQueue, type BullMqAdapterConfig } from './types.js';
export { MockBullMqQueue } from './MockBullMqQueue.js';

/**
 * BullMQ-backed queue adapter.
 *
 * In production, create the actual BullMQ Queue instance externally
 * and pass it in. For testing, use MockBullMqQueue.
 */
export class BullMqAdapter implements IQueueAdapter {
  private readonly queueName: string;
  private readonly defaultAttempts: number;

  constructor(
    private readonly queue: IBullMqQueue,
    config: BullMqAdapterConfig = {},
  ) {
    this.queueName = config.queueName ?? 'default';
    this.defaultAttempts = config.defaultAttempts ?? 3;
  }

  async push<T = unknown>(job: QueuedJob<T>): Promise<string> {
    const result = await this.queue.add(job.name, {
      name: job.name,
      payload: job.payload,
    }, {
      attempts: job.maxTries ?? this.defaultAttempts,
    });
    return result.id ?? `bull_${Date.now()}`;
  }

  async pushRaw(payload: string, _queue?: string): Promise<string> {
    const result = await this.queue.add('raw', { raw: payload }, {});
    return result.id ?? `bull_${Date.now()}`;
  }

  async later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    const result = await this.queue.add(job.name, {
      name: job.name,
      payload: job.payload,
    }, {
      delay: delaySeconds * 1000,
      attempts: job.maxTries ?? this.defaultAttempts,
    });
    return result.id ?? `bull_${Date.now()}`;
  }

  async size(_queue?: string): Promise<number> {
    const counts = await this.queue.getJobCounts();
    return (counts['waiting'] ?? 0) + (counts['delayed'] ?? 0);
  }

  async pop(_queue?: string): Promise<QueuedJob | null> {
    // BullMQ uses Worker-based consumption, not pop.
    return null;
  }

  async purge(): Promise<void> {
    await this.queue.obliterate({ force: true });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  getQueueName(): string { return this.queueName; }
}

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@formwork/core/adapters';

/**
 * Create a QueueManager-compatible driver factory for the BullMQ adapter.
 *
 * @param queueFactory - Callback that creates an `IBullMqQueue` from config.
 * @returns A `DriverFactory` to pass to `QueueManager.registerDriver('bullmq', …)`.
 *
 * @example
 * ```ts
 * import { Queue } from 'bullmq';
 * import { createBullMqDriverFactory } from '@formwork/queue-bullmq';
 *
 * queueManager.registerDriver('bullmq', createBullMqDriverFactory(
 *   (cfg) => new Queue(cfg['queueName'] as string ?? 'default', { connection: cfg['connection'] }),
 * ));
 * ```
 */
export function createBullMqDriverFactory(
  queueFactory: (config: Record<string, unknown>) => IBullMqQueue,
): CarpenterFactoryAdapter {
  return (config: { driver: string; [key: string]: unknown }) =>
    new BullMqAdapter(queueFactory(config), config as BullMqAdapterConfig);
}
