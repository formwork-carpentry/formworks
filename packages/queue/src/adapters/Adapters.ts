/**
 * @module @carpentry/queue
 * @description Queue adapters — Sync (immediate), Memory (testing/assertion)
 * @patterns Command (Job), Adapter (queue drivers), Template Method (BaseJob)
 * @principles LSP — all adapters substitutable; DIP — app dispatches via IQueueAdapter
 */

import type { IQueueAdapter, QueuedJob } from "@carpentry/core/contracts";

// ── BaseJob — Template Method ─────────────────────────────

/**
 * BaseJob — foundation for defining queue jobs.
 *
 * Extend `BaseJob` and implement `handle(payload)`. Job definitions provide static metadata
 * (queue name, retries, timeouts) used by `toQueuedJob()` for dispatch/serialization.
 *
 * @example
 * ```ts
 * import { BaseJob, dispatch } from '@carpentry/queue';
 *
 * type Payload = { userId: number };
 *
 * class SendEmail extends BaseJob<Payload> {
 *   static queue = 'emails';
 *   static maxTries = 5;
 *
 *   async handle(payload: Payload): Promise<void> {
 *     console.log('Sending email to', payload.userId);
 *   }
 * }
 *
 * await dispatch(SendEmail, { userId: 42 });
 * ```
 */
export abstract class BaseJob<T = unknown> {
  /** Queue name (default: 'default') */
  static queue = "default";
  /** Max retry attempts */
  static maxTries = 3;
  /** Seconds before retry */
  static retryAfterSeconds = 60;
  /** Job timeout in seconds */
  static timeout = 300;

  /** Override this to process the job */
  abstract handle(payload: T): Promise<void>;

  /** Called when all retries are exhausted */
  failed(_payload: T, _error: Error): void {
    // Override in subclass for failure handling
  }

  /** Convert to a dispatchable QueuedJob */
  static toQueuedJob<P>(payload: P): QueuedJob<P> {
    return {
      // biome-ignore lint/complexity/noThisInStatic: subclasses override static metadata used when dispatching jobs.
      name: this.name,
      payload,
      // biome-ignore lint/complexity/noThisInStatic: subclasses override static metadata used when dispatching jobs.
      queue: this.queue,
      // biome-ignore lint/complexity/noThisInStatic: subclasses override static metadata used when dispatching jobs.
      maxTries: this.maxTries,
      // biome-ignore lint/complexity/noThisInStatic: subclasses override static metadata used when dispatching jobs.
      retryAfterSeconds: this.retryAfterSeconds,
      // biome-ignore lint/complexity/noThisInStatic: subclasses override static metadata used when dispatching jobs.
      timeout: this.timeout,
      attempts: 0,
    };
  }
}

// ── SyncQueueAdapter — executes immediately ───────────────

/**
 * SyncQueueAdapter — immediate in-process queue adapter.
 *
 * It does not persist jobs; instead, you register handlers for job names and `push()`
 * executes the matching handler right away.
 *
 * @example
 * ```ts
 * import { SyncQueueAdapter } from '@carpentry/queue';
 *
 * const adapter = new SyncQueueAdapter();
 * adapter.registerHandler('SendEmail', async (payload) => {
 *   console.log('SendEmail', payload);
 * });
 *
 * await adapter.push({ name: 'SendEmail', payload: { userId: 1 }, queue: 'default', attempts: 0, maxTries: 3, retryAfterSeconds: 60, timeout: 300 } as any);
 * ```
 */
export class SyncQueueAdapter implements IQueueAdapter {
  private handlers = new Map<string, (payload: unknown) => Promise<void>>();

  /** Register a handler for a job name (must be done before dispatch) */
  /**
   * @param {string} jobName
   * @param {(payload: unknown) => Promise<void>} handler
   */
  registerHandler(jobName: string, handler: (payload: unknown) => Promise<void>): void {
    this.handlers.set(jobName, handler);
  }

  /**
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async push<T>(job: QueuedJob<T>): Promise<string> {
    const handler = this.handlers.get(job.name);
    if (handler) {
      await handler(job.payload);
    }
    return `sync-${Date.now()}`;
  }

  /**
   * @param {string} payload
   * @returns {Promise<string>}
   */
  async pushRaw(payload: string, _queue?: string): Promise<string> {
    const parsed = JSON.parse(payload) as QueuedJob;
    return this.push(parsed);
  }

  /**
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async later<T>(_delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    // Sync adapter ignores delay — executes immediately
    return this.push(job);
  }

  /**
   * @returns {Promise<number>}
   */
  async size(_queue?: string): Promise<number> {
    return 0; // sync adapter has no queue
  }

  /**
   * @returns {Promise<QueuedJob | null>}
   */
  async pop(_queue?: string): Promise<QueuedJob | null> {
    return null; // sync adapter processes inline
  }
}

// ── MemoryQueueAdapter — stores jobs for testing ──────────

/**
 * MemoryQueueAdapter — in-memory queue adapter for unit tests.
 *
 * Supports basic enqueue (`push`/`later`) and dequeue (`pop`) with FIFO behavior per queue.
 * Includes assertion helpers for verifying that jobs were enqueued as expected.
 *
 * @example
 * ```ts
 * import { MemoryQueueAdapter } from '@carpentry/queue';
 *
 * const adapter = new MemoryQueueAdapter();
 * await adapter.push({ name: 'SendEmail', payload: { userId: 1 }, queue: 'emails', attempts: 0, maxTries: 3, retryAfterSeconds: 60, timeout: 300 } as any);
 *
 * adapter.assertPushed('SendEmail', 'emails');
 *
 * const job = await adapter.pop('emails');
 * // job?.name === 'SendEmail'
 * ```
 */
export class MemoryQueueAdapter implements IQueueAdapter {
  private queues = new Map<string, QueuedJob[]>();

  /**
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async push<T>(job: QueuedJob<T>): Promise<string> {
    const queue = job.queue ?? "default";
    if (!this.queues.has(queue)) this.queues.set(queue, []);
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const queueJobs = this.queues.get(queue);
    if (queueJobs) queueJobs.push({ ...job, id });
    return id;
  }

  /**
   * @param {string} payload
   * @param {string} [queue]
   * @returns {Promise<string>}
   */
  async pushRaw(payload: string, queue = "default"): Promise<string> {
    const job = JSON.parse(payload) as QueuedJob;
    job.queue = queue;
    return this.push(job);
  }

  /**
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async later<T>(_delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    return this.push(job);
  }

  /**
   * @param {string} [queue]
   * @returns {Promise<number>}
   */
  async size(queue = "default"): Promise<number> {
    return this.queues.get(queue)?.length ?? 0;
  }

  /**
   * @param {string} [queue]
   * @returns {Promise<QueuedJob | null>}
   */
  async pop(queue = "default"): Promise<QueuedJob | null> {
    const q = this.queues.get(queue);
    if (!q || q.length === 0) return null;
    return q.shift() ?? null;
  }

  // ── Test Assertions ─────────────────────────────────────

  /** Assert a job with the given name was pushed */
  /**
   * @param {string} jobName
   * @param {string} [queue]
   */
  assertPushed(jobName: string, queue = "default"): void {
    const q = this.queues.get(queue) ?? [];
    const found = q.some((j) => j.name === jobName);
    if (!found) {
      const names = q.map((j) => j.name).join(", ");
      throw new Error(`Expected job "${jobName}" to be pushed to "${queue}". Found: [${names}]`);
    }
  }

  /** Assert no jobs were pushed */
  assertNothingPushed(): void {
    let total = 0;
    for (const q of this.queues.values()) total += q.length;
    if (total > 0) throw new Error(`Expected no jobs pushed, but ${total} found.`);
  }

  /** Assert exact count of jobs pushed to a queue */
  /**
   * @param {number} count
   * @param {string} [queue]
   */
  assertCount(count: number, queue = "default"): void {
    const actual = this.queues.get(queue)?.length ?? 0;
    if (actual !== count) {
      throw new Error(`Expected ${count} jobs on "${queue}", found ${actual}.`);
    }
  }

  /** Get all jobs from a queue (for inspection) */
  /**
   * @param {string} [queue]
   * @returns {QueuedJob[]}
   */
  getJobs(queue = "default"): QueuedJob[] {
    return [...(this.queues.get(queue) ?? [])];
  }

  /** Reset all queues */
  reset(): void {
    this.queues.clear();
  }
}
