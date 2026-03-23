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
    void job;
    throw new Error('DatabaseQueueAdapter.push() not yet implemented');
  }

  async pushRaw(payload: string, queue?: string): Promise<string> {
    void payload; void queue;
    throw new Error('DatabaseQueueAdapter.pushRaw() not yet implemented');
  }

  async later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    void delaySeconds; void job;
    throw new Error('DatabaseQueueAdapter.later() not yet implemented');
  }

  async size(queue?: string): Promise<number> {
    void queue;
    throw new Error('DatabaseQueueAdapter.size() not yet implemented');
  }

  async pop(queue?: string): Promise<QueuedJob | null> {
    void queue;
    throw new Error('DatabaseQueueAdapter.pop() not yet implemented');
  }

  async clear(queue?: string): Promise<void> {
    void queue;
    throw new Error('DatabaseQueueAdapter.clear() not yet implemented');
  }
}
