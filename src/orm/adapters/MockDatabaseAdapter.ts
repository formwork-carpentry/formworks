/**
 * @module @carpentry/orm
 * @description Mock database adapter for testing — records all queries, returns configured results
 * @patterns Adapter (implements IDatabaseAdapter), Test Double
 * @principles LSP — fully substitutable for any real adapter
 */

import type { IDatabaseAdapter, CompiledQuery, QueryResult } from '@carpentry/formworks/core/contracts';

/**
 * MockDatabaseAdapter — records executed queries and returns queued {@link QueryResult} rows.
 *
 * Use `queueResult()` before code under test; inspect `executedQueries` or assertion helpers.
 *
 * @example
 * ```ts
 * const db = new MockDatabaseAdapter()
 *   .queueResult([{ id: 1, name: 'Alice' }], 1);
 * const row = await db.execute({ sql: 'SELECT 1', bindings: [], type: 'select' });
 * expect(db.executedQueries.length).toBe(1);
 * ```
 */
export class MockDatabaseAdapter implements IDatabaseAdapter {
  /** All queries that were executed */
  public executedQueries: CompiledQuery[] = [];

  /** Queue of results to return (FIFO) */
  private resultQueue: QueryResult<unknown>[] = [];

  /** Default result if queue is empty */
  private defaultResult: QueryResult<unknown> = { rows: [], rowCount: 0 };

  driverName(): string { return 'mock'; }
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  async close(): Promise<void> {
    await this.disconnect();
  }

  async run(
    _sql: string,
    _params: unknown[] = [],
  ): Promise<{ affectedRows: number; insertId?: number }> {
    return { affectedRows: 0 };
  }

  /**
   * @param {CompiledQuery} query
   * @returns {Promise<QueryResult<T>>}
   */
  async execute<T>(query: CompiledQuery): Promise<QueryResult<T>> {
    this.executedQueries.push(query);
    const result = this.resultQueue.shift() ?? this.defaultResult;
    return result as QueryResult<T>;
  }

  /**
   * @param {string} sql
   * @param {unknown[]} [bindings]
   * @returns {Promise<QueryResult<T>>}
   */
  async raw<T>(sql: string, bindings: unknown[] = []): Promise<QueryResult<T>> {
    return this.execute<T>({ sql, bindings, type: 'raw' });
  }

  // ── Test helpers ────────────────────────────────────────

  /** Queue a result to be returned on the next execute() call */
  /**
   * @param {unknown[]} rows
   * @param {number} [rowCount]
   * @param {number | string} [insertId]
   * @returns {this}
   */
  queueResult(rows: unknown[], rowCount?: number, insertId?: number | string): this {
    this.resultQueue.push({
      rows: rows,
      rowCount: rowCount ?? rows.length,
      insertId,
    });
    return this;
  }

  /** Set default result for when queue is empty */
  /**
   * @param {unknown[]} [rows]
   * @param {number} [rowCount]
   * @returns {this}
   */
  setDefaultResult(rows: unknown[] = [], rowCount: number = 0): this {
    this.defaultResult = { rows: rows, rowCount };
    return this;
  }

  /** Get the last executed query */
  lastQuery(): CompiledQuery | undefined {
    return this.executedQueries[this.executedQueries.length - 1];
  }

  /** Assert a specific SQL was executed */
  /**
   * @param {string} sqlFragment
   */
  assertExecuted(sqlFragment: string): void {
    const found = this.executedQueries.some((q) => q.sql.includes(sqlFragment));
    if (!found) {
      const executed = this.executedQueries.map((q) => q.sql).join('\n  ');
      throw new Error(
        `Expected query containing "${sqlFragment}" but none found.\nExecuted:\n  ${executed || '(none)'}`,
      );
    }
  }

  /** Assert number of queries executed */
  /**
   * @param {number} count
   */
  assertQueryCount(count: number): void {
    if (this.executedQueries.length !== count) {
      throw new Error(
        `Expected ${count} queries but ${this.executedQueries.length} were executed.`,
      );
    }
  }

  /** Reset all recorded state */
  reset(): void {
    this.executedQueries = [];
    this.resultQueue = [];
    this.defaultResult = { rows: [], rowCount: 0 };
  }
}
