/**
 * @module @formwork/queue
 * @description DatabaseQueueAdapter — persists jobs to a database table via QueryBuilder
 * @patterns Adapter (implements IQueueAdapter), Repository (job table CRUD)
 * @principles LSP (substitutable for SyncQueue/BullMQ), SRP (DB job persistence only)
 */

import type { IDatabaseAdapter } from "@formwork/core/contracts";
import type { IQueueAdapter, QueuedJob } from "@formwork/core/contracts";
import { QueryBuilder } from "@formwork/orm";

export interface DatabaseQueueConfig {
  /** Table name for jobs (default: 'jobs') */
  table?: string;
  /** Default queue name (default: 'default') */
  defaultQueue?: string;
  /** Number of seconds before a reserved job is released (default: 90) */
  retryAfter?: number;
}

interface JobRow {
  id: string;
  queue: string;
  payload: string;
  attempts: number;
  max_tries: number;
  available_at: number;
  reserved_at: number | null;
  created_at: string;
}

/**
 * Database-backed queue adapter. Stores jobs in a SQL table
 * and retrieves them in FIFO order, respecting delays and reservations.
 *
 * @example
 * ```ts
 * const queue = new DatabaseQueueAdapter(dbAdapter, { table: 'jobs' });
 * await queue.push({ name: 'SendEmail', payload: { to: 'user@example.com' } });
 * const job = await queue.pop();
 * ```
 */
export class DatabaseQueueAdapter implements IQueueAdapter {
  private readonly table: string;
  private readonly defaultQueue: string;
  private readonly retryAfter: number;
  private idCounter = 0;

  constructor(
    private readonly db: IDatabaseAdapter,
    config: DatabaseQueueConfig = {},
  ) {
    this.table = config.table ?? "jobs";
    this.defaultQueue = config.defaultQueue ?? "default";
    this.retryAfter = config.retryAfter ?? 90;
  }

  /**
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async push<T = unknown>(job: QueuedJob<T>): Promise<string> {
    return this.insertJob(job, 0);
  }

  /**
   * @param {string} payload
   * @param {string} [queue]
   * @returns {Promise<string>}
   */
  async pushRaw(payload: string, queue?: string): Promise<string> {
    const job: QueuedJob = { name: "raw", payload, queue };
    return this.insertJob(job, 0);
  }

  /**
   * @param {number} delaySeconds
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async later<T = unknown>(delaySeconds: number, job: QueuedJob<T>): Promise<string> {
    return this.insertJob(job, delaySeconds);
  }

  /**
   * @param {string} [queue]
   * @returns {Promise<number>}
   */
  async size(queue?: string): Promise<number> {
    const queueName = queue ?? this.defaultQueue;
    const result = await this.qb()
      .where("queue", queueName)
      .where("reserved_at", "IS NULL", undefined)
      .count();
    return result;
  }

  /**
   * @param {string} [queue]
   * @returns {Promise<QueuedJob | null>}
   */
  async pop(queue?: string): Promise<QueuedJob | null> {
    const queueName = queue ?? this.defaultQueue;
    const now = Math.floor(Date.now() / 1000);

    const row = (await this.qb()
      .where("queue", queueName)
      .where("available_at", "<=", now)
      .where("reserved_at", "IS NULL", undefined)
      .orderBy("id", "asc")
      .first()) as JobRow | null;

    if (!row) return null;

    // Reserve the job
    await this.qb()
      .where("id", row.id)
      .update({ reserved_at: now, attempts: row.attempts + 1 });

    const parsed = JSON.parse(row.payload);
    return {
      id: row.id,
      name: parsed.name,
      payload: parsed.payload,
      queue: row.queue,
      attempts: row.attempts + 1,
      maxTries: row.max_tries,
    };
  }

  /** Delete a completed job */
  /**
   * @param {string} jobId
   * @returns {Promise<void>}
   */
  async delete(jobId: string): Promise<void> {
    await this.qb().where("id", jobId).delete();
  }

  /** Release a failed job back to the queue */
  /**
   * @param {string} jobId
   * @param {number} [delaySeconds]
   * @returns {Promise<void>}
   */
  async release(jobId: string, delaySeconds: number = this.retryAfter): Promise<void> {
    const availableAt = Math.floor(Date.now() / 1000) + delaySeconds;
    await this.qb().where("id", jobId).update({ reserved_at: null, available_at: availableAt });
  }

  /** Get all failed jobs (exceeded max_tries) */
  /**
   * @param {string} [queue]
   * @returns {Promise<QueuedJob[]>}
   */
  async failed(queue?: string): Promise<QueuedJob[]> {
    const queueName = queue ?? this.defaultQueue;
    const rows = (await this.qb().where("queue", queueName).get()) as unknown as JobRow[];

    return rows
      .filter((r) => r.attempts >= r.max_tries && r.max_tries > 0)
      .map((r) => this.rowToJob(r));
  }

  /** Purge all jobs from a queue */
  /**
   * @param {string} [queue]
   * @returns {Promise<number>}
   */
  async purge(queue?: string): Promise<number> {
    const queueName = queue ?? this.defaultQueue;
    return this.qb().where("queue", queueName).delete();
  }

  private async insertJob<T>(job: QueuedJob<T>, delaySeconds: number): Promise<string> {
    const id = job.id ?? this.generateId();
    const now = Math.floor(Date.now() / 1000);

    await this.qb().insert({
      id,
      queue: job.queue ?? this.defaultQueue,
      payload: JSON.stringify({ name: job.name, payload: job.payload }),
      attempts: 0,
      max_tries: job.maxTries ?? 3,
      available_at: now + delaySeconds,
      reserved_at: null,
      created_at: new Date().toISOString(),
    });

    return id;
  }

  private rowToJob(row: JobRow): QueuedJob {
    const parsed = JSON.parse(row.payload);
    return {
      id: row.id,
      name: parsed.name,
      payload: parsed.payload,
      queue: row.queue,
      attempts: row.attempts,
      maxTries: row.max_tries,
    };
  }

  private qb(): QueryBuilder {
    return new QueryBuilder(this.db, this.table);
  }

  private generateId(): string {
    return `job_${++this.idCounter}_${Date.now().toString(36)}`;
  }
}
