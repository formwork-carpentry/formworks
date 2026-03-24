/**
 * @module @carpentry/queue-database
 * @description Type definitions for the database-backed queue adapter.
 */

/** Configuration for DatabaseQueueAdapter */
export interface DatabaseQueueConfig {
  /** Database table name for jobs (default: 'jobs') */
  table?: string;
  /** Default queue name (default: 'default') */
  queue?: string;
  /** Number of seconds after which a reserved job is considered failed (default: 60) */
  retryAfterSeconds?: number;
}
