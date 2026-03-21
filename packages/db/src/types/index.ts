/**
 * @module @formwork/db
 * @description Shared query types for database adapters.
 */

export type CompiledQueryType =
  | 'schema'
  | 'insert'
  | 'select'
  | 'update'
  | 'delete'
  | 'raw'
  | 'aggregate';

export interface CompiledQuery {
  sql: string;
  bindings: unknown[];
  type: CompiledQueryType;
}

export interface QueryResult<T extends Record<string, unknown> = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  insertId?: number | string;
}
