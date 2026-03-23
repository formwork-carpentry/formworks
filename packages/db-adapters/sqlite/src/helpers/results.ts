/**
 * @module @carpentry/db-sqlite/helpers/results
 * @description Result-shaping helpers for the SQLite adapter.
 */
import type { CompiledQuery } from '../types.js';

/**
 * Decide whether a compiled query should read rows via `all()`.
 *
 * @param query - Compiled query.
 * @returns Whether the query returns rows.
 */
export function shouldReturnRows(query: CompiledQuery): boolean {
  return query.type === 'select'
    || query.type === 'aggregate'
    || /^\s*select\b/i.test(query.sql);
}

/**
 * Normalize a SQLite insert identifier into the framework result format.
 *
 * @param value - Driver-provided insert identifier.
 * @returns Normalized numeric insert identifier.
 */
export function normalizeSQLiteInsertId(value: number | bigint | undefined): number | undefined {
  if (typeof value === 'bigint') return Number(value);
  return typeof value === 'number' ? value : undefined;
}
