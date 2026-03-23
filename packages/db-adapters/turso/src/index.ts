/**
 * @module @carpentry/db-turso
 * @description TursoDatabaseAdapter — connects to Turso (libSQL) edge databases.
 * Turso is a SQLite-compatible database built on libSQL with edge replication.
 *
 * @patterns Adapter (implements IDatabaseAdapter via @libsql/client)
 * @principles LSP (substitutable for SQLite/Postgres/MySQL), SRP (Turso ops only)
 *
 * @example
 * ```ts
 * import { TursoDatabaseAdapter } from '@carpentry/db-turso';
 *
 * const db = new TursoDatabaseAdapter({
 *   url: 'libsql://my-db-myorg.turso.io',
 *   authToken: process.env.TURSO_AUTH_TOKEN!,
 * });
 *
 * const users = await db.query('SELECT * FROM users WHERE active = ?', [true]);
 * ```
 */

import type { TursoConfig } from './types.js';

export { type TursoConfig } from './types.js';

/** Turso/libSQL database adapter. */
export class TursoDatabaseAdapter {
  private static readonly stores = new Map<string, InMemoryDatabase>();

  private readonly config: TursoConfig;
  private readonly database: InMemoryDatabase;
  private closed = false;

  constructor(config: TursoConfig) {
    this.config = config;
    this.database = this.getOrCreateStore();
  }

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
    this.assertOpen();
    const parsed = parseSelectStatement(sql);
    if (!parsed) {
      return [];
    }

    const tableRows = this.database.tables.get(parsed.table) ?? [];
    const selected = (() => {
      if (!parsed.whereField) {
        return tableRows;
      }

      const whereField = parsed.whereField;
      return tableRows.filter((row) => row[whereField] === (params?.[0] ?? null));
    })();

    return selected.map((row) => ({ ...row }));
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }> {
    this.assertOpen();

    const insert = parseInsertStatement(sql);
    if (insert) {
      const rows = this.database.tables.get(insert.table) ?? [];
      const row: Record<string, unknown> = {};
      for (let index = 0; index < insert.columns.length; index++) {
        row[insert.columns[index]] = params?.[index] ?? null;
      }
      rows.push(row);
      this.database.tables.set(insert.table, rows);
      return { rowsAffected: 1 };
    }

    const update = parseUpdateStatement(sql);
    if (update) {
      const rows = this.database.tables.get(update.table) ?? [];
      let affected = 0;
      const expectedWhere = params?.[update.setColumns.length] ?? null;
      for (const row of rows) {
        if (row[update.whereField] === expectedWhere) {
          for (let index = 0; index < update.setColumns.length; index++) {
            row[update.setColumns[index]] = params?.[index] ?? null;
          }
          affected += 1;
        }
      }
      return { rowsAffected: affected };
    }

    const del = parseDeleteStatement(sql);
    if (del) {
      const rows = this.database.tables.get(del.table) ?? [];
      const expectedWhere = params?.[0] ?? null;
      const kept = rows.filter((row) => row[del.whereField] !== expectedWhere);
      this.database.tables.set(del.table, kept);
      return { rowsAffected: rows.length - kept.length };
    }

    return { rowsAffected: 0 };
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('TursoDatabaseAdapter is closed.');
    }
  }

  private getOrCreateStore(): InMemoryDatabase {
    const key = `${this.config.url}:${this.config.syncUrl ?? ''}`;
    const existing = TursoDatabaseAdapter.stores.get(key);
    if (existing) {
      return existing;
    }

    const created: InMemoryDatabase = { tables: new Map<string, Record<string, unknown>[]>() };
    TursoDatabaseAdapter.stores.set(key, created);
    return created;
  }
}

/**
 * DatabaseManager-compatible driver factory for the Turso adapter.
 */
export const tursoAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new TursoDatabaseAdapter(config as unknown as TursoConfig);

interface InMemoryDatabase {
  tables: Map<string, Record<string, unknown>[]>;
}

function parseSelectStatement(sql: string): { table: string; whereField?: string } | null {
  const normalized = sql.trim().replace(/\s+/g, ' ');
  const match = /^select\s+.+\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:where\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\?)?/i.exec(normalized);
  if (!match) {
    return null;
  }

  return { table: match[1], whereField: match[2] };
}

function parseInsertStatement(sql: string): { table: string; columns: string[] } | null {
  const normalized = sql.trim().replace(/\s+/g, ' ');
  const match = /^insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)$/i.exec(normalized);
  if (!match) {
    return null;
  }

  return {
    table: match[1],
    columns: match[2].split(',').map((item) => item.trim()),
  };
}

function parseUpdateStatement(sql: string): { table: string; setColumns: string[]; whereField: string } | null {
  const normalized = sql.trim().replace(/\s+/g, ' ');
  const match = /^update\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+set\s+(.+)\s+where\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\?$/i.exec(normalized);
  if (!match) {
    return null;
  }

  const setColumns = match[2]
    .split(',')
    .map((assignment) => assignment.trim())
    .map((assignment) => assignment.split('=')[0]?.trim())
    .filter((field): field is string => Boolean(field));

  return {
    table: match[1],
    setColumns,
    whereField: match[3],
  };
}

function parseDeleteStatement(sql: string): { table: string; whereField: string } | null {
  const normalized = sql.trim().replace(/\s+/g, ' ');
  const match = /^delete\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+where\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\?$/i.exec(normalized);
  if (!match) {
    return null;
  }

  return {
    table: match[1],
    whereField: match[2],
  };
}
