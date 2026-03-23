/**
 * @module @carpentry/core/contracts/audit
 * @description Audit logging contract — records who did what and when.
 *
 * Implementations: DatabaseAuditLogger, FileAuditLogger
 *
 * @example
 * ```ts
 * const audit = container.make<IAuditLogger>('audit');
 * await audit.log({
 *   actor: { type: 'user', id: '42' },
 *   action: 'order.created',
 *   target: { type: 'order', id: '1001' },
 *   metadata: { total: 59.99 },
 * });
 * ```
 */

/** The entity performing an action. */
export interface AuditActor {
  type: string;
  id: string;
  name?: string;
  ip?: string;
}

/** The entity being acted upon. */
export interface AuditTarget {
  type: string;
  id: string;
  name?: string;
}

/** A single audit log entry. */
export interface AuditEntry {
  /** Who performed the action */
  actor: AuditActor;
  /** What action was performed (e.g., 'user.updated', 'order.deleted') */
  action: string;
  /** What was acted upon */
  target?: AuditTarget;
  /** Before-state for change tracking */
  before?: Record<string, unknown>;
  /** After-state for change tracking */
  after?: Record<string, unknown>;
  /** Additional context */
  metadata?: Record<string, unknown>;
  /** When the action occurred (defaults to now) */
  timestamp?: Date;
}

/** Query options for retrieving audit logs. */
export interface AuditQuery {
  actorId?: string;
  actorType?: string;
  targetId?: string;
  targetType?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  perPage?: number;
}

/** @typedef {Object} IAuditLogger - Audit logging contract */
export interface IAuditLogger {
  /** Record an audit entry. */
  log(entry: AuditEntry): Promise<void>;
  /** Query audit log entries. */
  query(options: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }>;
}
