/**
 * @module @carpentry/core/contracts/queue
 * @description Queue adapter contract - all queue drivers implement this interface.
 *
 * Implementations: SyncQueue, MemoryQueue, DatabaseQueueAdapter, BullMqAdapter
 *
 * @example
 * ```ts
 * const queue = container.make<IQueueAdapter>('queue');
 * await queue.push({ name: 'SendEmail', payload: { to: 'user@test.com' } });
 * await queue.later(60, { name: 'SendReminder', payload: { userId: 42 } });
 * ```
 */

/** @typedef {Object} QueuedJob - A job to be processed by the queue */
export interface QueuedJob<T = unknown> {
  /** @property {string} [id] - Queue-specific job identifier */
  id?: string;
  /** @property {string} name - Job class/handler name */
  name: string;
  /** @property {T} payload - Job data */
  payload: T;
  /** @property {string} [queue] - Target queue name (default: 'default') */
  queue?: string;
  /** @property {number} [attempts] - Number of attempts already made */
  attempts?: number;
  /** @property {number} [maxTries] - Maximum retry attempts */
  maxTries?: number;
  /** @property {number} [retryAfterSeconds] - Delay before retrying a failed job */
  retryAfterSeconds?: number;
  /** @property {number} [timeout] - Timeout in seconds */
  timeout?: number;
}

/** @typedef {Object} IQueueAdapter - Queue adapter contract */
export interface IQueueAdapter {
  /**
   * Push a job onto the queue for immediate processing.
   * @param {QueuedJob<T>} job - Job to enqueue
   * @returns {Promise<string>} Job ID
   * @example
   * ```ts
   * const jobId = await queue.push({ name: 'ProcessOrder', payload: { orderId: 123 } });
   * ```
   */
  push<T = unknown>(job: QueuedJob<T>): Promise<string>;

  /**
   * Push a raw payload string onto the queue.
   * @param {string} payload - Serialized job payload
   * @param {string} [queue] - Target queue name
   * @returns {Promise<string>} Job ID
   */
  pushRaw(payload: string, queue?: string): Promise<string>;

  /**
   * Push a job with a delay before it becomes available.
   * @param {number} delaySeconds - Seconds to wait before the job is processable
   * @param {QueuedJob<T>} job - Job to enqueue
   * @returns {Promise<string>} Job ID
   * @example
   * ```ts
   * // Send reminder email in 30 minutes
   * await queue.later(1800, { name: 'SendReminder', payload: { userId: 42 } });
   * ```
   */
  later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string>;

  /**
   * Get the number of jobs waiting in the queue.
   * @param {string} [queue] - Queue name (default: 'default')
   * @returns {Promise<number>} Number of pending jobs
   */
  size(queue?: string): Promise<number>;

  /**
   * Pop the next job from the queue (pull-based consumption).
   * @param {string} [queue] - Queue name
   * @returns {Promise<QueuedJob | null>} Next job, or null if queue is empty
   */
  pop(queue?: string): Promise<QueuedJob | null>;
}
