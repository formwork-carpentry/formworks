/**
 * @module @carpentry/queue-sqs
 * @description SqsQueueAdapter — processes jobs via AWS SQS.
 *
 * @patterns Adapter (implements IQueueAdapter via @aws-sdk/client-sqs)
 * @principles LSP (substitutable for BullMQ/Database/Memory queue), SRP (SQS ops only)
 *
 * @example
 * ```ts
 * import { SqsQueueAdapter } from '@carpentry/queue-sqs';
 *
 * const queue = new SqsQueueAdapter({
 *   queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
 *   region: 'us-east-1',
 * });
 *
 * await queue.push({ name: 'SendEmail', payload: { to: 'user@example.com' } });
 * ```
 */

import type { IQueueAdapter, QueuedJob } from '@carpentry/core/contracts';
import type { SqsConfig } from './types.js';

export { type SqsConfig } from './types.js';

/** AWS SQS queue adapter. */
export class SqsQueueAdapter implements IQueueAdapter {
  private readonly config: SqsConfig;

  constructor(config: SqsConfig) {
    this.config = config;
  }

  async push<T = unknown>(job: QueuedJob<T>): Promise<string> {
    void job;
    throw new Error('SqsQueueAdapter.push() not yet implemented — install @aws-sdk/client-sqs');
  }

  async pushRaw(payload: string, queue?: string): Promise<string> {
    void payload; void queue;
    throw new Error('SqsQueueAdapter.pushRaw() not yet implemented');
  }

  async later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    void delaySeconds; void job;
    throw new Error('SqsQueueAdapter.later() not yet implemented');
  }

  async size(queue?: string): Promise<number> {
    void queue;
    throw new Error('SqsQueueAdapter.size() not yet implemented');
  }

  async pop(queue?: string): Promise<QueuedJob | null> {
    void queue;
    throw new Error('SqsQueueAdapter.pop() not yet implemented');
  }

  async clear(queue?: string): Promise<void> {
    void queue;
    throw new Error('SqsQueueAdapter.clear() not yet implemented');
  }
}
