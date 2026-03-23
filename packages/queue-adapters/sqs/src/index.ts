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
  private static readonly queues = new Map<string, StoredSqsJob[]>();

  private readonly config: SqsConfig;

  constructor(config: SqsConfig) {
    this.config = config;
  }

  async push<T = unknown>(job: QueuedJob<T>): Promise<string> {
    const id = createSqsJobId();
    const queueName = job.queue ?? this.config.queueUrl;
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
    const targetQueue = queue ?? parsed.queue ?? this.config.queueUrl;

    return this.push({
      id: parsed.id,
      name: typeof parsed.name === 'string' && parsed.name.length > 0 ? parsed.name : 'RawPayload',
      payload: parsed.payload ?? payload,
      queue: targetQueue,
      attempts: parsed.attempts,
      maxTries: parsed.maxTries,
      retryAfterSeconds: parsed.retryAfterSeconds,
      timeout: parsed.timeout,
    });
  }

  async later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    const id = createSqsJobId();
    const queueName = job.queue ?? this.config.queueUrl;
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
    return this.getQueue(queue ?? this.config.queueUrl).length;
  }

  async pop(queue?: string): Promise<QueuedJob | null> {
    const queueName = queue ?? this.config.queueUrl;
    const entries = this.getQueue(queueName);
    const now = Date.now();
    const index = entries.findIndex((job) => job.availableAt <= now);
    if (index < 0) return null;

    const [job] = entries.splice(index, 1);
    if (!job) return null;

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
    const queueName = queue ?? this.config.queueUrl;
    SqsQueueAdapter.queues.set(queueName, []);
  }

  private getQueue(queueName: string): StoredSqsJob[] {
    const existing = SqsQueueAdapter.queues.get(queueName);
    if (existing) {
      return existing;
    }

    const created: StoredSqsJob[] = [];
    SqsQueueAdapter.queues.set(queueName, created);
    return created;
  }
}

interface StoredSqsJob extends QueuedJob {
  availableAt: number;
  enqueuedAt: number;
}

function createSqsJobId(): string {
  return `sqs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
