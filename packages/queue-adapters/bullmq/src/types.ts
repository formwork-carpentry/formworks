/**
 * @module @carpentry/queue-bullmq
 * @description Type definitions for the BullMQ queue adapter.
 */

/** BullMQ-compatible Queue interface — allows mock injection */
export interface IBullMqQueue {
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id?: string }>;
  getJobCounts(): Promise<Record<string, number>>;
  obliterate(opts?: { force?: boolean }): Promise<void>;
  close(): Promise<void>;
}

/** Configuration for BullMqAdapter */
export interface BullMqAdapterConfig {
  /** Queue name (default: 'default') */
  queueName?: string;
  /** Default retry attempts (default: 3) */
  defaultAttempts?: number;
}
