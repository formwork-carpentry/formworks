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
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

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
  private static readonly databaseStore = new Map<string, StoredAuditEntry[]>();
  private readonly config: AuditConfig;

  constructor(config: AuditConfig) {
    this.config = config;
  }

  async log(entry: AuditEntry): Promise<void> {
    const normalized = normalizeEntry(entry);

    switch (this.config.driver) {
      case 'null': {
        return;
      }
      case 'database': {
        const table = this.config.table ?? 'audit_logs';
        const existing = AuditManager.databaseStore.get(table) ?? [];
        const previous = existing[existing.length - 1];
        const stored = withChain(normalized, previous);
        existing.push(stored);
        AuditManager.databaseStore.set(table, existing);
        return;
      }
      case 'file': {
        if (!this.config.path) {
          throw new Error('AuditManager(file) requires config.path to be defined.');
        }

        const existing = await readFileEntries(this.config.path);
        const previous = existing[existing.length - 1];
        const stored = withChain(normalized, previous);
        await mkdir(dirname(this.config.path), { recursive: true });
        await appendFile(this.config.path, `${JSON.stringify(serializeEntry(stored))}\n`, 'utf-8');
        return;
      }
      default: {
        throw new Error(`Unsupported audit driver: "${this.config.driver}"`);
      }
    }
  }

  async query(options: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }> {
    const source = await this.readEntries();
    const filtered = source.filter((entry) => matchesQuery(entry, options));

    const page = options.page ?? 1;
    const perPage = options.perPage ?? 50;
    const start = Math.max(0, (page - 1) * perPage);
    const end = start + Math.max(1, perPage);

    return {
      entries: filtered.slice(start, end).map(stripChainMetadata),
      total: filtered.length,
    };
  }

  private async readEntries(): Promise<StoredAuditEntry[]> {
    switch (this.config.driver) {
      case 'null':
        return [];
      case 'database': {
        const table = this.config.table ?? 'audit_logs';
        return AuditManager.databaseStore.get(table) ?? [];
      }
      case 'file': {
        if (!this.config.path) {
          throw new Error('AuditManager(file) requires config.path to be defined.');
        }
        return readFileEntries(this.config.path);
      }
      default:
        throw new Error(`Unsupported audit driver: "${this.config.driver}"`);
    }
  }
}

interface StoredAuditEntry extends AuditEntry {
  timestamp: Date;
  chainHash: string;
  previousChainHash: string | null;
}

function normalizeEntry(entry: AuditEntry): AuditEntry {
  return {
    ...entry,
    actor: { ...entry.actor },
    target: entry.target ? { ...entry.target } : undefined,
    before: entry.before ? { ...entry.before } : undefined,
    after: entry.after ? { ...entry.after } : undefined,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
    timestamp: entry.timestamp ?? new Date(),
  };
}

function withChain(entry: AuditEntry, previous?: StoredAuditEntry): StoredAuditEntry {
  const timestamp = entry.timestamp ?? new Date();
  const previousChainHash = previous?.chainHash ?? null;
  const chainHash = createChainHash(entry, previousChainHash, timestamp);

  return {
    ...entry,
    timestamp,
    chainHash,
    previousChainHash,
  };
}

function createChainHash(entry: AuditEntry, previousChainHash: string | null, timestamp: Date): string {
  const payload = JSON.stringify({
    actor: entry.actor,
    action: entry.action,
    target: entry.target ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    metadata: entry.metadata ?? null,
    timestamp: timestamp.toISOString(),
    previousChainHash,
  });

  return createHash('sha256').update(payload).digest('hex');
}

function matchesQuery(entry: StoredAuditEntry, query: AuditQuery): boolean {
  if (query.actorId && entry.actor.id !== query.actorId) return false;
  if (query.actorType && entry.actor.type !== query.actorType) return false;
  if (query.targetId && entry.target?.id !== query.targetId) return false;
  if (query.targetType && entry.target?.type !== query.targetType) return false;
  if (query.action && entry.action !== query.action) return false;
  if (query.from && entry.timestamp < query.from) return false;
  if (query.to && entry.timestamp > query.to) return false;
  return true;
}

function stripChainMetadata(entry: StoredAuditEntry): AuditEntry {
  return {
    actor: { ...entry.actor },
    action: entry.action,
    target: entry.target ? { ...entry.target } : undefined,
    before: entry.before ? { ...entry.before } : undefined,
    after: entry.after ? { ...entry.after } : undefined,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
    timestamp: new Date(entry.timestamp),
  };
}

function serializeEntry(entry: StoredAuditEntry): Record<string, unknown> {
  return {
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  };
}

async function readFileEntries(path: string): Promise<StoredAuditEntry[]> {
  let raw = '';
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    return [];
  }

  const entries: StoredAuditEntry[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim().length === 0) continue;

    const parsed = JSON.parse(line) as {
      actor: AuditEntry['actor'];
      action: string;
      target?: AuditEntry['target'];
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      timestamp: string;
      chainHash: string;
      previousChainHash: string | null;
    };

    entries.push({
      actor: parsed.actor,
      action: parsed.action,
      target: parsed.target,
      before: parsed.before,
      after: parsed.after,
      metadata: parsed.metadata,
      timestamp: new Date(parsed.timestamp),
      chainHash: parsed.chainHash,
      previousChainHash: parsed.previousChainHash,
    });
  }

  return entries;
}
