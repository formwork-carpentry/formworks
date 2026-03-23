/**
 * @module @carpentry/queue
 * @description QueueManager — resolves queue adapters by name, proxies to default.
 * Extends {@link CarpenterFactoryBase} for shared driver registration, lazy resolution, and instance caching.
 *
 * @patterns Abstract Factory, Strategy
 * @principles DIP — dispatch via interface; OCP — new drivers via registerDriver
 *             DRY — shared resolution logic via CarpenterFactoryBase
 */

import { CarpenterFactoryBase } from "@carpentry/core/adapters";
import type { IQueueAdapter, QueuedJob } from "@carpentry/core/contracts";
import { MemoryQueueAdapter, SyncQueueAdapter } from "../adapters/Adapters.js";
import { QueueNotInitializedError } from "../exceptions/base.js";

export interface QueueConnectionConfig {
  driver: string;
  [key: string]: unknown;
}

export type QueueDriverFactory = (config: QueueConnectionConfig) => IQueueAdapter;

/**
 * Resolve named queue connections and proxy job methods to the selected adapter.
 *
 * `QueueManager` implements {@link IQueueAdapter} by delegating to {@link connection()}
 * (defaulting to the configured default connection).
 *
 * @example
 * ```ts
 * import { QueueManager } from '@carpentry/queue';
 *
 * const manager = new QueueManager('sync', {
 *   sync: { driver: 'sync' },
 * });
 *
 * await manager.push({ name: 'SendEmail', payload: { userId: 1 } });
 * ```
 *
 * @see IQueueAdapter — Queue adapter contract
 * @see CarpenterFactoryBase — shared driver registration and resolution
 */
export class QueueManager
  extends CarpenterFactoryBase<IQueueAdapter, QueueConnectionConfig>
  implements IQueueAdapter
{
  protected readonly resolverLabel = "connection";
  protected readonly domainLabel = "Queue";

  constructor(defaultConnection = "sync", configs: Record<string, QueueConnectionConfig> = {}) {
    super(defaultConnection, configs);
    this.registerDriver("sync", () => new SyncQueueAdapter());
    this.registerDriver("memory", () => new MemoryQueueAdapter());
  }

  /**
   * @param {string} [name]
   * @returns {IQueueAdapter}
   */
  connection(name?: string): IQueueAdapter {
    return this.resolve(name);
  }

  /**
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async push<T>(job: QueuedJob<T>): Promise<string> {
    return this.connection().push(job);
  }
  /**
   * @param {string} payload
   * @param {string} [queue]
   * @returns {Promise<string>}
   */
  async pushRaw(payload: string, queue?: string): Promise<string> {
    return this.connection().pushRaw(payload, queue);
  }
  /**
   * @param {number} delay
   * @param {QueuedJob<T>} job
   * @returns {Promise<string>}
   */
  async later<T>(delay: number, job: QueuedJob<T>): Promise<string> {
    return this.connection().later(delay, job);
  }
  /**
   * @param {string} [queue]
   * @returns {Promise<number>}
   */
  async size(queue?: string): Promise<number> {
    return this.connection().size(queue);
  }
  /**
   * @param {string} [queue]
   * @returns {Promise<QueuedJob | null>}
   */
  async pop(queue?: string): Promise<QueuedJob | null> {
    return this.connection().pop(queue);
  }
}

// ── Facade ────────────────────────────────────────────────

let globalQueueManager: QueueManager | null = null;
/**
 * @param {QueueManager} m
 */
export function setQueueManager(m: QueueManager): void {
  globalQueueManager = m;
}

export const Queue = {
  push: <T>(job: QueuedJob<T>) => getManager().push(job),
  later: <T>(delay: number, job: QueuedJob<T>) => getManager().later(delay, job),
  size: (queue?: string) => getManager().size(queue),
  connection: (name?: string) => getManager().connection(name),
};

function getManager(): QueueManager {
  /**
   * @param {unknown} !globalQueueManager
   */
  if (!globalQueueManager) throw new QueueNotInitializedError();
  return globalQueueManager;
}

/** Helper to dispatch a BaseJob-style class */
/**
 * @param {{ toQueuedJob(payload: T} jobClass
 * @returns {Promise<QueuedJob<T> }, payload: T): Promise<string>>}
 */
export function dispatch<T>(
  jobClass: { toQueuedJob(payload: T): QueuedJob<T> },
  payload: T,
): Promise<string> {
  return getManager().push(jobClass.toQueuedJob(payload));
}
