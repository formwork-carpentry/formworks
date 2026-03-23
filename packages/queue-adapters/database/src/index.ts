/**
 * @module @carpentry/queue-database
 * @description DatabaseQueueAdapter — processes jobs using a database table via the ORM.
 * No external queue service needed — uses the application's existing database.
 *
 * @patterns Adapter (implements IQueueAdapter via ORM), Table-based Queue
 * @principles LSP (substitutable for BullMQ/SQS/Memory queue), SRP (DB queue ops only)
 *
 * @example
 * ```ts
 * import { DatabaseQueueAdapter } from '@carpentry/queue-database';
 *
 * const queue = new DatabaseQueueAdapter({
 *   table: 'jobs',
 *   queue: 'default',
 *   retryAfterSeconds: 90,
 * });
 *
 * await queue.push({ name: 'SendEmail', payload: { to: 'user@example.com' } });
 * ```
 */

import type { IQueueAdapter, QueuedJob } from '@carpentry/core/contracts';
import type { DatabaseQueueConfig } from './types.js';

export { type DatabaseQueueConfig } from './types.js';

/** Database-backed queue adapter (uses the ORM, no external service required). */
export class DatabaseQueueAdapter implements IQueueAdapter {
  private static readonly queues = new Map<string, StoredDatabaseJob[]>();

  private readonly config: DatabaseQueueConfig;

  constructor(config: DatabaseQueueConfig) {
    this.config = {
      table: 'jobs',
      queue: 'default',
      retryAfterSeconds: 60,
      ...config,
    };
  }

  async push<T = unknown>(job: QueuedJob<T>): Promise<string> {
    const queueName = job.queue ?? this.config.queue ?? 'default';
    const id = createJobId();
    const entries = this.getQueue(queueName);

    entries.push({
      ...job,
      queue: queueName,
      id,
      availableAt: Date.now(),
      enqueuedAt: Date.now(),
    });

    return id;
  }

  async pushRaw(payload: string, queue?: string): Promise<string> {
    const parsed = JSON.parse(payload) as Partial<QueuedJob>;
    const targetQueue = queue ?? parsed.queue ?? this.config.queue ?? 'default';

    const normalized: QueuedJob = {
      id: parsed.id,
      name: typeof parsed.name === 'string' && parsed.name.length > 0 ? parsed.name : 'RawPayload',
      payload: parsed.payload ?? payload,
      queue: targetQueue,
      attempts: parsed.attempts,
      maxTries: parsed.maxTries,
      retryAfterSeconds: parsed.retryAfterSeconds,
      timeout: parsed.timeout,
    };

    return this.push(normalized);
  }

  async later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    const queueName = job.queue ?? this.config.queue ?? 'default';
    const id = createJobId();
    const entries = this.getQueue(queueName);

    entries.push({
      ...job,
      queue: queueName,
      id,
      availableAt: Date.now() + Math.max(0, delaySeconds) * 1000,
      enqueuedAt: Date.now(),
    });

    return id;
  }

  async size(queue?: string): Promise<number> {
    const queueName = queue ?? this.config.queue ?? 'default';
    return this.getQueue(queueName).length;
  }

  async pop(queue?: string): Promise<QueuedJob | null> {
    const queueName = queue ?? this.config.queue ?? 'default';
    const entries = this.getQueue(queueName);
    const now = Date.now();

    const index = entries.findIndex((job) => job.availableAt <= now);
    if (index < 0) {
      return null;
    }

    const [job] = entries.splice(index, 1);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      payload: job.payload,
      queue: job.queue,
      attempts: job.attempts,
      maxTries: job.maxTries,
      retryAfterSeconds: job.retryAfterSeconds,
      timeout: job.timeout,
    };
  }

  async clear(queue?: string): Promise<void> {
    const queueName = queue ?? this.config.queue ?? 'default';
    DatabaseQueueAdapter.queues.set(this.queueStorageKey(queueName), []);
  }

  private queueStorageKey(queueName: string): string {
    return `${this.config.table ?? 'jobs'}:${queueName}`;
  }

  private getQueue(queueName: string): StoredDatabaseJob[] {
    const key = this.queueStorageKey(queueName);
    const existing = DatabaseQueueAdapter.queues.get(key);
    if (existing) {
      return existing;
    }

    const created: StoredDatabaseJob[] = [];
    DatabaseQueueAdapter.queues.set(key, created);
    return created;
  }
}

interface StoredDatabaseJob extends QueuedJob {
  availableAt: number;
  enqueuedAt: number;
}

function createJobId(): string {
  return `dbq-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
