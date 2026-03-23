/**
 * @module @carpentry/db-mysql/types
 * @description Shared MySQL adapter configuration and driver contracts.
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
 * Runtime configuration consumed by {@link MySQLAdapter}.
 *
 * @example
 * ```ts
 * const config: MySQLConnectionConfig = {
 *   host: 'localhost',
 *   database: 'carpenter',
 *   username: 'app',
 *   connectionLimit: 10,
 * };
 * ```
 */
export interface MySQLConnectionConfig {
  driver?: 'mysql';
  host: string;
  port?: number;
  database: string;
  user?: string;
  username?: string;
  password?: string;
  connectionLimit?: number;
  waitForConnections?: boolean;
  queueLimit?: number;
  charset?: string;
  timezone?: string;
}

/** Minimal mutation header returned by `mysql2`. */
export interface IMySQLResultHeader {
  affectedRows: number;
  insertId?: number;
}

/** Shared executable contract used by pools and transactional connections. */
export interface IMySQLExecutable {
  execute<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<[T[] | IMySQLResultHeader, unknown]>;
}

/** Transaction-scoped MySQL connection contract. */
export interface IMySQLTransactionConnection extends IMySQLExecutable {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

/** MySQL pool contract consumed by the adapter. */
export interface IMySQLPool extends IMySQLExecutable {
  getConnection(): Promise<IMySQLTransactionConnection>;
  end(): Promise<void>;
}

/** Minimal driver module surface loaded from `mysql2/promise`. */
export interface IMySQLDriverModule {
  createPool(config: Record<string, unknown>): IMySQLPool;
}

/** Lazy loader that resolves the optional MySQL dependency when needed. */
export type MySQLDriverLoader = () => Promise<IMySQLDriverModule>;

/** Injectable collaborators for tests or custom pooling strategies. */
export interface MySQLAdapterDependencies {
  pool?: IMySQLPool;
  driverLoader?: MySQLDriverLoader;
}
