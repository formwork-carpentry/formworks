/**
 * @module @formwork/queue
 * @description BullMqAdapter — production queue adapter backed by Redis via BullMQ.
 *
 * WHY: In-memory and sync queues lose jobs on restart. BullMQ provides persistent,
 * distributed job processing with retries, delays, priorities, rate limiting,
 * and a dashboard (Bull Board). It's the standard for Node.js background jobs.
 *
 * HOW: Wraps BullMQ's Queue (for producing) and Worker (for consuming) with the
 * IQueueAdapter interface. Jobs are serialized to JSON, stored in Redis, and
 * processed by workers that can run on separate processes/machines.
 *
 * @patterns Adapter (BullMQ → IQueueAdapter), Producer-Consumer
 * @principles LSP (substitutable for SyncQueue/MemoryQueue), SRP (BullMQ operations only)
 *
 * @example
 * ```ts
 * const adapter = new BullMqAdapter({
 *   connection: { host: 'localhost', port: 6379 },
 *   queueName: 'emails',
 * });
 *
 * // Push a job
 * await adapter.push({ name: 'SendWelcome', payload: { userId: 42 } });
 *
 * // Push with delay (30 seconds)
 * await adapter.later(30, { name: 'SendReminder', payload: { userId: 42 } });
 * ```
 */

import type { IQueueAdapter, QueuedJob } from "@formwork/core/contracts";

/** BullMQ-compatible Queue interface — allows mock injection */
export interface IBullMqQueue {
  /**
   * @param {string} name
   * @param {unknown} data
   * @param {Object} [opts]
   * @returns {Promise<}
   */
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id?: string }>;
  getJobCounts(): Promise<Record<string, number>>;
  /**
   * @param {{ force?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  obliterate(opts?: { force?: boolean }): Promise<void>;
  close(): Promise<void>;
}

/** BullMQ connection options */
export interface BullMqConfig {
  /** Redis connection: host/port or URL */
  connection: { host: string; port: number } | { url: string };
  /** Queue name (default: 'default') */
  queueName?: string;
  /** Default job options */
  defaultJobOptions?: { attempts?: number; backoff?: { type: string; delay: number } };
}

/**
 * BullMQ-backed queue adapter.
 *
 * NOTE: In production, create the actual BullMQ Queue instance externally
 * and pass it in. For testing, use MockBullMqQueue.
 */
export class BullMqAdapter implements IQueueAdapter {
  private readonly queueName: string;
  private readonly defaultAttempts: number;

  constructor(
    private readonly queue: IBullMqQueue,
    config: { queueName?: string; defaultAttempts?: number } = {},
  ) {
    this.queueName = config.queueName ?? "default";
    this.defaultAttempts = config.defaultAttempts ?? 3;
  }

  /**
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async push<T = unknown>(job: QueuedJob<T>): Promise<string> {
    const result = await this.queue.add(
      job.name,
      {
        name: job.name,
        payload: job.payload,
      },
      {
        attempts: job.maxTries ?? this.defaultAttempts,
      },
    );
    return result.id ?? `bull_${Date.now()}`;
  }

  /**
   * @param {string} payload
   * @param {string} [queue]
   * @returns {Promise<string>}
   */
  async pushRaw(payload: string, _queue?: string): Promise<string> {
    const result = await this.queue.add("raw", { raw: payload }, {});
    return result.id ?? `bull_${Date.now()}`;
  }

  /**
   * @param {number} delaySeconds
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    const result = await this.queue.add(
      job.name,
      {
        name: job.name,
        payload: job.payload,
      },
      {
        delay: delaySeconds * 1000,
        attempts: job.maxTries ?? this.defaultAttempts,
      },
    );
    return result.id ?? `bull_${Date.now()}`;
  }

  /**
   * @param {string} [queue]
   * @returns {Promise<number>}
   */
  async size(_queue?: string): Promise<number> {
    const counts = await this.queue.getJobCounts();
    // BullMQ returns counts by state: waiting, active, delayed, etc.
    return (counts.waiting ?? 0) + (counts.delayed ?? 0);
  }

  /**
   * @param {string} [queue]
   * @returns {Promise<QueuedJob | null>}
   */
  async pop(_queue?: string): Promise<QueuedJob | null> {
    // BullMQ uses Worker-based consumption (pull model), not pop.
    // This method is for interface compatibility — in production,
    // use BullMQ Worker directly for processing.
    return null;
  }

  /** Purge all jobs from the queue */
  async purge(): Promise<void> {
    await this.queue.obliterate({ force: true });
  }

  /** Close the queue connection */
  async close(): Promise<void> {
    await this.queue.close();
  }

  /** Get the queue name */
  getQueueName(): string {
    return this.queueName;
  }
}

/**
 * Mock BullMQ Queue for testing — no Redis needed.
 *
 * @example
 * ```ts
 * const mockQueue = new MockBullMqQueue();
 * const adapter = new BullMqAdapter(mockQueue);
 * await adapter.push({ name: 'Test', payload: {} });
 * expect(mockQueue.getJobs()).toHaveLength(1);
 * ```
 */
export class MockBullMqQueue implements IBullMqQueue {
  private jobs: Array<{ id: string; name: string; data: unknown; opts: Record<string, unknown> }> =
    [];
  private idCounter = 0;

  /**
   * @param {string} name
   * @param {unknown} data
   * @param {Object} [opts]
   * @returns {Promise<}
   */
  async add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }> {
    const id = `mock_${++this.idCounter}`;
    this.jobs.push({ id, name, data, opts: opts ?? {} });
    return { id };
  }

  async getJobCounts(): Promise<Record<string, number>> {
    return { waiting: this.jobs.length, active: 0, delayed: 0, completed: 0, failed: 0 };
  }

  async obliterate(): Promise<void> {
    this.jobs = [];
  }
  async close(): Promise<void> {}

  /** Test helper: get all queued jobs */
  getJobs() {
    return [...this.jobs];
  }
  /** Test helper: clear jobs */
  clear() {
    this.jobs = [];
  }
}
