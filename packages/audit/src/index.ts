/**
 * @module @carpentry/audit
 * @description Audit logging — records who did what and when with change tracking.
 * Provides database and file-based audit loggers with tamper-evident chains.
 *
 * Builds on the IAuditLogger contract from @carpentry/core/contracts/audit.
 *
 * @patterns Observer (model events trigger audit entries), Strategy (pluggable storage)
 * @principles SRP (audit concerns only), OCP (new storage backends without modification)
 *
 * @example
 * ```ts
 * import { AuditManager } from '@carpentry/audit';
 *
 * const audit = new AuditManager({ driver: 'database' });
 * await audit.log({
 *   actor: { type: 'user', id: '42' },
 *   action: 'order.created',
 *   target: { type: 'order', id: '1001' },
 * });
 *
 * const entries = await audit.query({ actorId: '42', from: yesterday });
 * ```
 */

import type { AuditEntry, AuditQuery, IAuditLogger } from '@carpentry/core/contracts';

export type {
  AuditActor,
  AuditEntry,
  AuditQuery,
  AuditTarget,
  IAuditLogger,
} from '@carpentry/core/contracts';

/** Configuration for AuditManager. */
export interface AuditConfig {
  /** Driver to use: 'database' | 'file' | 'null' */
  driver: string;
  /** Database table name (for database driver, default: 'audit_logs') */
  table?: string;
  /** File path (for file driver) */
  path?: string;
}

/** Manages audit logging with pluggable storage backends. */
export class AuditManager implements IAuditLogger {
  private readonly config: AuditConfig;

  constructor(config: AuditConfig) {
    this.config = config;
  }

  async log(entry: AuditEntry): Promise<void> {
    void entry;
    throw new Error(`AuditManager(${this.config.driver}).log() not yet implemented`);
  }

  async query(options: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }> {
    void options;
    throw new Error(`AuditManager(${this.config.driver}).query() not yet implemented`);
  }
}
