/**
 * @module @carpentry/db
 * @description In-memory SQLite-style adapter for tests — no native dependencies.
 */

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';
import type { IDatabaseAdapter } from '@carpentry/core/contracts';
import type { CompiledQuery, QueryResult } from './types';

/**
 * SQLite in-memory adapter for tests/dev (simplified SQL, not a full engine).
 *
 * @example
 * ```ts
 * const db = new MemoryDbAdapter();
 * await db.execute({ sql: 'CREATE TABLE t (id)', bindings: [], type: 'schema' });
 * ```
 */
export class SQLiteMemoryAdapter implements IDatabaseAdapter {
  private tables = new Map<string, Record<string, unknown>[]>();
  private autoIncrements = new Map<string, number>();
  private queryLog: CompiledQuery[] = [];

  driverName(): string { return 'sqlite-memory'; }
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> { this.tables.clear(); }
  async beginTransaction(): Promise<void> {  }
  async commit(): Promise<void> {  }
  async rollback(): Promise<void> {  }

  async run(sql: string, params: unknown[] = []): Promise<{ affectedRows: number; insertId?: number }> {
    const result = await this.execute({ sql, bindings: params, type: 'raw' });
    return {
      affectedRows: result.rowCount,
      insertId: typeof result.insertId === 'number' ? result.insertId : undefined,
    };
  }

  async close(): Promise<void> {
    await this.disconnect();
  }

  async execute(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  async execute<T = Record<string, unknown>>(query: CompiledQuery): Promise<QueryResult<T>>;
  async execute<T = Record<string, unknown>>(
    arg1: string | CompiledQuery,
    arg2: unknown[] = [],
  ): Promise<QueryResult<T> | Record<string, unknown>[]> {
    const query: CompiledQuery = typeof arg1 === 'string'
      ? { sql: arg1, bindings: arg2, type: 'raw' }
      : arg1;

    this.queryLog.push(query);

    const sqlUpper = query.sql.trim().toUpperCase();
    const result: QueryResult<T> =
      sqlUpper.startsWith('CREATE TABLE') ? this.executeCreateTable(query) as QueryResult<T>
        : sqlUpper.startsWith('DROP TABLE') ? this.executeDrop(query) as QueryResult<T>
          : sqlUpper.startsWith('INSERT') ? this.executeInsert(query) as QueryResult<T>
            : sqlUpper.startsWith('SELECT') ? this.executeSelect(query) as QueryResult<T>
              : sqlUpper.startsWith('UPDATE') ? this.executeUpdate(query) as QueryResult<T>
                : sqlUpper.startsWith('DELETE') ? this.executeDelete(query) as QueryResult<T>
                  : { rows: [] as T[], rowCount: 0 };

    return typeof arg1 === 'string' ? result.rows as Record<string, unknown>[] : result;
  }

  async raw<T = Record<string, unknown>>(sql: string, bindings: unknown[] = []): Promise<QueryResult<T>> {
    return this.execute<T>({ sql, bindings, type: 'raw' });
  }

  private executeCreateTable(query: CompiledQuery): QueryResult {
    const match = query.sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
    if (match) {
      const table = match[1];
      if (!this.tables.has(table)) {
        this.tables.set(table, []);
        this.autoIncrements.set(table, 0);
      }
    }
    return { rows: [], rowCount: 0 };
  }

  private executeDrop(query: CompiledQuery): QueryResult {
    const match = query.sql.match(/DROP TABLE (?:IF EXISTS )?(\w+)/i);
    if (match) {
      this.tables.delete(match[1]);
      this.autoIncrements.delete(match[1]);
    }
    return { rows: [], rowCount: 0 };
  }

  private executeInsert(query: CompiledQuery): QueryResult {
    const match = query.sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES/i);
    if (!match) return { rows: [], rowCount: 0 };

    const table = match[1];
    const columns = match[2].split(',').map((c: string) => c.trim());
    const rows = this.tables.get(table) ?? [];

    const valuePlaceholders = query.sql.match(/\(([^)]*\?[^)]*)\)/g);
    if (!valuePlaceholders) return { rows: [], rowCount: 0 };

    let bindIdx = 0;
    let lastId = this.autoIncrements.get(table) ?? 0;

    for (const _ of valuePlaceholders) {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        row[col] = query.bindings[bindIdx++];
      }
      if (!('id' in row)) {
        lastId++;
        row['id'] = lastId;
      }
      rows.push(row);
    }

    this.autoIncrements.set(table, lastId);
    if (!this.tables.has(table)) this.tables.set(table, rows);

    return { rows: [], rowCount: valuePlaceholders.length, insertId: lastId };
  }

  private executeSelect(query: CompiledQuery): QueryResult {
    const match = query.sql.match(/FROM (\w+)/i);
    if (!match) return { rows: [], rowCount: 0 };

    const table = match[1];
    let rows = [...(this.tables.get(table) ?? [])];

    const whereMatch = query.sql.match(/WHERE (.+?)(?:ORDER|LIMIT|GROUP|$)/i);
    if (whereMatch && query.bindings.length > 0) {
      rows = this.applyWheres(rows, query.sql, query.bindings);
    }

    const limitMatch = query.sql.match(/LIMIT (\d+)/i);
    if (limitMatch) rows = rows.slice(0, Number(limitMatch[1]));

    const offsetMatch = query.sql.match(/OFFSET (\d+)/i);
    if (offsetMatch) rows = rows.slice(Number(offsetMatch[1]));

    return { rows, rowCount: rows.length };
  }

  private executeUpdate(query: CompiledQuery): QueryResult {
    const match = query.sql.match(/UPDATE (\w+) SET (.+?)(?:WHERE|$)/i);
    if (!match) return { rows: [], rowCount: 0 };

    const table = match[1];
    const rows = this.tables.get(table) ?? [];

    const setCols = match[2].split(',').map((s: string) => s.trim().split('=')[0].trim());
    const setValues = query.bindings.slice(0, setCols.length);
    const whereBindings = query.bindings.slice(setCols.length);

    let affected = 0;
    const filtered = query.sql.includes('WHERE')
      ? this.filterRows(rows, query.sql.substring(query.sql.toUpperCase().indexOf('WHERE')), whereBindings)
      : rows;

    for (const row of filtered) {
      for (let i = 0; i < setCols.length; i++) {
        row[setCols[i]] = setValues[i];
      }
      affected++;
    }

    return { rows: [], rowCount: affected };
  }

  private executeDelete(query: CompiledQuery): QueryResult {
    const match = query.sql.match(/DELETE FROM (\w+)/i);
    if (!match) return { rows: [], rowCount: 0 };

    const table = match[1];
    const rows = this.tables.get(table) ?? [];

    if (!query.sql.toUpperCase().includes('WHERE')) {
      const count = rows.length;
      this.tables.set(table, []);
      return { rows: [], rowCount: count };
    }

    const toDelete = this.applyWheres(rows, query.sql, query.bindings);
    const toDeleteSet = new Set(toDelete);
    this.tables.set(table, rows.filter((r) => !toDeleteSet.has(r)));

    return { rows: [], rowCount: toDelete.length };
  }

  private applyWheres(rows: Record<string, unknown>[], sql: string, bindings: unknown[]): Record<string, unknown>[] {
    const whereMatch = sql.match(/WHERE (\w+)\s*=\s*\?/i);
    if (whereMatch && bindings.length > 0) {
      const col = whereMatch[1];
      const val = bindings[bindings.length > 1 ? bindings.length - 1 : 0];
      return rows.filter((r) => r[col] === val);
    }
    return rows;
  }

  private filterRows(rows: Record<string, unknown>[], whereSql: string, bindings: unknown[]): Record<string, unknown>[] {
    return this.applyWheres(rows, whereSql, bindings);
  }

  getTable(name: string): Record<string, unknown>[] { return [...(this.tables.get(name) ?? [])]; }
  getTableNames(): string[] { return [...this.tables.keys()]; }
  getQueryLog(): CompiledQuery[] { return [...this.queryLog]; }
  clearQueryLog(): void { this.queryLog = []; }
  reset(): void { this.tables.clear(); this.autoIncrements.clear(); this.queryLog = []; }
}

/**
 * DatabaseManager-compatible driver factory for the in-memory adapter.
 */
export const memoryAdapter: CarpenterFactoryAdapter = () => new SQLiteMemoryAdapter();
