/**
 * @module @carpentry/log
 * @description AuditLogger — CRUD/auth event auditing with value diffing
 * @patterns Observer (audit events), Template Method (action tracking)
 * @principles SRP (only audit logging)
 */

import type { Logger } from "./Logger.js";

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "viewed"
  | "exported"
  | "imported"
  | "login"
  | "logout"
  | "failed_login"
  | "permission_granted"
  | "permission_denied"
  | string; // extensible

export interface AuditEntry {
  /** Who performed the action */
  userId: string | number | null;
  userName?: string;
  /** What action was taken */
  action: AuditAction;
  /** What resource was affected */
  resourceType: string;
  resourceId?: string | number;
  /** What changed — old/new values for updates */
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  /** Where the action came from */
  ipAddress?: string;
  userAgent?: string;
  /** When */
  timestamp: Date;
  /** Additional context (request ID, tenant, etc.) */
  metadata?: Record<string, unknown>;
}

// ── Audit Channel Interface ───────────────────────────────

export interface IAuditChannel {
  readonly name: string;
  /**
   * @param {AuditEntry} entry
   * @returns {Promise<void> | void}
   */
  record(entry: AuditEntry): Promise<void> | void;
}

// ── InMemoryAuditChannel — for testing ────────────────────

/**
 * InMemoryAuditChannel — stores audit entries in memory for assertions.
 *
 * Supports basic inspection helpers:
 * - `all()`, `count()`
 * - `forUser()`, `forResource()`, `forAction()`
 * - `trail()` for chronological resource history
 *
 * @example
 * ```ts
 * const channel = new InMemoryAuditChannel();
 * const audit = new AuditLogger([channel]);
 *
 * audit.setUserResolver(() => 'u1');
 * await audit.created('user', 'u1', { email: 'a@b.com' });
 *
 * channel.assertRecorded('created', 'user');
 * ```
 */
export class InMemoryAuditChannel implements IAuditChannel {
  readonly name = "memory";
  private entries: AuditEntry[] = [];

  /**
   * @param {AuditEntry} entry
   */
  record(entry: AuditEntry): void {
    this.entries.push({ ...entry });
  }

  all(): AuditEntry[] {
    return [...this.entries];
  }
  count(): number {
    return this.entries.length;
  }

  /**
   * @param {string | number} userId
   * @returns {AuditEntry[]}
   */
  forUser(userId: string | number): AuditEntry[] {
    return this.entries.filter((e) => e.userId === userId);
  }

  /**
   * @param {string} type
   * @param {string | number} [id]
   * @returns {AuditEntry[]}
   */
  forResource(type: string, id?: string | number): AuditEntry[] {
    return this.entries.filter(
      (e) => e.resourceType === type && (id === undefined || e.resourceId === id),
    );
  }

  /**
   * @param {AuditAction} action
   * @returns {AuditEntry[]}
   */
  forAction(action: AuditAction): AuditEntry[] {
    return this.entries.filter((e) => e.action === action);
  }

  /** Get audit trail for a specific resource (chronological) */
  /**
   * @param {string} resourceType
   * @param {string | number} resourceId
   * @returns {AuditEntry[]}
   */
  trail(resourceType: string, resourceId: string | number): AuditEntry[] {
    return this.entries
      .filter((e) => e.resourceType === resourceType && e.resourceId === resourceId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // ── Assertions ────────────────────────────────────────

  /**
   * @param {AuditAction} action
   * @param {string} [resourceType]
   */
  assertRecorded(action: AuditAction, resourceType?: string): void {
    const matches = this.entries.filter(
      (e) => e.action === action && (resourceType === undefined || e.resourceType === resourceType),
    );
    if (matches.length === 0) {
      throw new Error(
        `Expected audit entry for action "${action}"${resourceType ? ` on "${resourceType}"` : ""}, but none found.`,
      );
    }
  }

  /**
   * @param {AuditAction} action
   * @param {string} [resourceType]
   */
  assertNotRecorded(action: AuditAction, resourceType?: string): void {
    const matches = this.entries.filter(
      (e) => e.action === action && (resourceType === undefined || e.resourceType === resourceType),
    );
    if (matches.length > 0) {
      throw new Error(
        `Expected NO audit for "${action}"${resourceType ? ` on "${resourceType}"` : ""}, but ${matches.length} found.`,
      );
    }
  }

  /**
   * @param {string | number} userId
   * @param {AuditAction} action
   */
  assertUserActed(userId: string | number, action: AuditAction): void {
    const matches = this.entries.filter((e) => e.userId === userId && e.action === action);
    if (matches.length === 0)
      throw new Error(`Expected user "${userId}" to have performed "${action}", but none found.`);
  }

  /**
   * @param {string} resourceType
   * @param {string | number} resourceId
   * @param {string} field
   */
  assertChanges(resourceType: string, resourceId: string | number, field: string): void {
    const matches = this.entries.filter(
      (e) =>
        e.resourceType === resourceType &&
        e.resourceId === resourceId &&
        (e.oldValues?.[field] !== undefined || e.newValues?.[field] !== undefined),
    );
    if (matches.length === 0) {
      throw new Error(
        `Expected audit entry with changes to "${field}" on ${resourceType}#${resourceId}, but none found.`,
      );
    }
  }

  reset(): void {
    this.entries = [];
  }
}

// ── LogAuditChannel — writes audit entries to the app logger ──

/**
 * LogAuditChannel — records audit events using a {@link Logger}.
 *
 * Each audit record is written as a structured log entry (action, resource, old/new values).
 */
export class LogAuditChannel implements IAuditChannel {
  readonly name = "log";
  constructor(private logger: Logger) {}

  /**
   * @param {AuditEntry} entry
   */
  record(entry: AuditEntry): void {
    this.logger.info(
      `AUDIT: ${entry.action} on ${entry.resourceType}${entry.resourceId ? `#${entry.resourceId}` : ""}`,
      {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        ip: entry.ipAddress,
        ...entry.metadata,
      },
    );
  }
}

// ── AuditLogger — the main audit interface ────────────────

/**
 * AuditLogger — high-level auditing API.
 *
 * It enriches entries with:
 * - current user ID (via `setUserResolver()`)
 * - default metadata (via `setMetadataResolver()`)
 * - timestamps and partial entry merging
 *
 * Then forwards the completed {@link AuditEntry} to each configured channel.
 */
export class AuditLogger {
  private channels: IAuditChannel[];
  private defaultUserId: (() => string | number | null) | null = null;
  private defaultMetadata: (() => Record<string, unknown>) | null = null;

  constructor(channels: IAuditChannel[] = []) {
    this.channels = channels;
  }

  /** Set a resolver for the current user ID (injected from auth) */
  /**
   * @param {() => (string | number | null)} resolver
   */
  setUserResolver(resolver: () => string | number | null): void {
    this.defaultUserId = resolver;
  }

  /** Set default metadata (request ID, tenant, etc.) */
  /**
   * @param {() => Record<string, unknown>} resolver
   */
  setMetadataResolver(resolver: () => Record<string, unknown>): void {
    this.defaultMetadata = resolver;
  }

  /** Record an audit entry */
  /**
   * @param {Object} entry
   * @returns {Promise<void>}
   */
  async record(
    entry: Partial<AuditEntry> & { action: AuditAction; resourceType: string },
  ): Promise<void> {
    const full: AuditEntry = {
      userId: entry.userId ?? this.defaultUserId?.() ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      timestamp: entry.timestamp ?? new Date(),
      metadata: { ...this.defaultMetadata?.(), ...entry.metadata },
    };
    if (entry.resourceId !== undefined) full.resourceId = entry.resourceId;
    if (entry.oldValues !== undefined) full.oldValues = entry.oldValues;
    if (entry.newValues !== undefined) full.newValues = entry.newValues;
    if (entry.ipAddress !== undefined) full.ipAddress = entry.ipAddress;
    if (entry.userAgent !== undefined) full.userAgent = entry.userAgent;

    for (const channel of this.channels) {
      await channel.record(full);
    }
  }

  // ── Convenience methods ─────────────────────────────────

  /**
   * @param {string} resourceType
   * @param {string | number} resourceId
   * @param {Object} [newValues]
   * @returns {Promise<void>}
   */
  async created(
    resourceType: string,
    resourceId: string | number,
    newValues?: Record<string, unknown>,
  ): Promise<void> {
    const entry: Partial<AuditEntry> & { action: AuditAction; resourceType: string } = {
      action: "created",
      resourceType,
      resourceId,
    };
    if (newValues !== undefined) entry.newValues = newValues;
    await this.record(entry);
  }

  /**
   * @param {string} resourceType
   * @param {string | number} resourceId
   * @param {Object} [oldValues]
   * @param {Object} [newValues]
   * @returns {Promise<void>}
   */
  async updated(
    resourceType: string,
    resourceId: string | number,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
  ): Promise<void> {
    const entry: Partial<AuditEntry> & { action: AuditAction; resourceType: string } = {
      action: "updated",
      resourceType,
      resourceId,
    };
    if (oldValues !== undefined) entry.oldValues = oldValues;
    if (newValues !== undefined) entry.newValues = newValues;
    await this.record(entry);
  }

  /**
   * @param {string} resourceType
   * @param {string | number} resourceId
   * @returns {Promise<void>}
   */
  async deleted(resourceType: string, resourceId: string | number): Promise<void> {
    await this.record({ action: "deleted", resourceType, resourceId });
  }

  /**
   * @param {string} resourceType
   * @param {string | number} [resourceId]
   * @returns {Promise<void>}
   */
  async viewed(resourceType: string, resourceId?: string | number): Promise<void> {
    const entry: Partial<AuditEntry> & { action: AuditAction; resourceType: string } = {
      action: "viewed",
      resourceType,
    };
    if (resourceId !== undefined) entry.resourceId = resourceId;
    await this.record(entry);
  }

  /**
   * @param {string | number} userId
   * @param {Object} [metadata]
   * @returns {Promise<void>}
   */
  async login(userId: string | number, metadata?: Record<string, unknown>): Promise<void> {
    const entry: Partial<AuditEntry> & { action: AuditAction; resourceType: string } = {
      userId,
      action: "login",
      resourceType: "session",
    };
    if (metadata !== undefined) entry.metadata = metadata;
    await this.record(entry);
  }

  /**
   * @param {string | number} userId
   * @returns {Promise<void>}
   */
  async logout(userId: string | number): Promise<void> {
    await this.record({ userId, action: "logout", resourceType: "session" });
  }

  /**
   * @param {Object} credentials
   * @param {Object} [metadata]
   * @returns {Promise<void>}
   */
  async failedLogin(
    credentials: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.record({
      userId: null,
      action: "failed_login",
      resourceType: "session",
      metadata: { ...metadata, credentials },
    });
  }

  /** Get audit channels (for testing) */
  getChannels(): IAuditChannel[] {
    return [...this.channels];
  }
}

// ── Facade ────────────────────────────────────────────────
