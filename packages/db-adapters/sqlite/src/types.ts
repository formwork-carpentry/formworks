/**
 * @module @formwork/db-sqlite/types
 * @description Shared SQLite adapter configuration and driver contracts.
 */

/** Compiled query type. */
export type CompiledQueryType = 'schema' | 'insert' | 'select' | 'update' | 'delete' | 'raw' | 'aggregate';

/** A compiled SQL query ready for execution. */
export interface CompiledQuery {
  sql: string;
  bindings: unknown[];
  type: CompiledQueryType;
}

/** Normalized query result returned by adapter methods. */
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  insertId?: number | string;
}

/** Database adapter contract used by the db-adapters packages. */
export interface IDatabaseAdapter {
  driverName(): string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  execute<T = Record<string, unknown>>(query: CompiledQuery): Promise<QueryResult<T>>;
  raw<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<QueryResult<T>>;
}

/**
 * Runtime configuration consumed by {@link SQLiteAdapter}.
 *
 * @example
 * ```ts
 * const config: SQLiteConnectionConfig = {
 *   database: './storage/database.sqlite',
 *   timeoutMs: 2000,
 * };
 * ```
 */
export interface SQLiteConnectionConfig {
  driver?: 'sqlite';
  database: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeoutMs?: number;
}


/** Minimal `better-sqlite3` mutation payload used by the adapter. */
export interface ISQLiteRunResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

/** Prepared statement contract consumed by the adapter. */
export interface ISQLiteStatement {
  all(...bindings: unknown[]): Record<string, unknown>[];
  run(...bindings: unknown[]): ISQLiteRunResult;
}

/** Database instance contract used to decouple the adapter from the concrete driver. */
export interface ISQLiteDatabase {
  prepare(sql: string): ISQLiteStatement;
  exec(sql: string): void;
  close(): void;
}

/** Constructor signature for the lazily loaded SQLite driver. */
export type SQLiteDriverConstructor = new (filename: string, options?: Record<string, unknown>) => ISQLiteDatabase;

/** Lazy loader that resolves the optional SQLite dependency when needed. */
export type SQLiteDriverLoader = () => Promise<SQLiteDriverConstructor>;

/** Collaborators that can be injected to simplify tests or custom wiring. */
export interface SQLiteAdapterDependencies {
  database?: ISQLiteDatabase;
  driverLoader?: SQLiteDriverLoader;
}
