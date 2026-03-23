/**
 * @module @carpentry/queue
 * @description Queue manager with pluggable adapters (sync, in-memory, database, and BullMQ via external adapters).
 *
 * Use this package to:
 * - Push jobs for immediate or delayed processing
 * - Swap queue backends via config/driver name
 * - Dispatch queue payloads with typed {@link QueuedJob} objects
 *
 * @example
 * ```ts
 * import { QueueManager } from './';
 *
 * const manager = new QueueManager('sync', {
 *   sync: { driver: 'sync' },
 * });
 *
 * const jobId = await manager.push({ name: 'SendEmail', payload: { userId: 1 } });
 * console.log(jobId);
 * ```
 *
 * @see QueueManager — Resolve named queue adapters
 */

export { BaseJob, SyncQueueAdapter, MemoryQueueAdapter } from "./adapters/Adapters.js";
export { MemoryQueueAdapter as InMemoryQueueDriver } from "./adapters/Adapters.js";
export {
  QueueManager,
  setQueueManager,
  Queue,
  dispatch,
  createQueueManager,
} from "./manager/index.js";
export type { QueueDriverFactory, QueueManagerFactoryDependencies } from "./manager/index.js";
export * from "./exceptions.js";

export { DatabaseQueueAdapter } from "./adapters/DatabaseQueueAdapter.js";
export type { DatabaseQueueConfig } from "./adapters/DatabaseQueueAdapter.js";
