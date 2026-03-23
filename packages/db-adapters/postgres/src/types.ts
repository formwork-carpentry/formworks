/**
 * @module @carpentry/db-postgres/types
 * @description Shared PostgreSQL adapter configuration and driver contracts.
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

/**
 * Database adapter contract used by the db-adapters packages.
 */
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
 * Runtime configuration consumed by {@link PostgresAdapter}.
 *
 * @example
 * ```ts
 * const config: PostgresConnectionConfig = {
 *   host: 'localhost',
 *   database: 'carpenter',
 *   username: 'app',
 *   maxConnections: 20,
 * };
 * ```
 */
export interface PostgresConnectionConfig {
  driver?: 'postgres';
  host: string;
  port?: number;
  database: string;
  user?: string;
  username?: string;
  password?: string;
  ssl?: boolean | Record<string, unknown>;
  maxConnections?: number;
  idleTimeoutMs?: number;
  statementTimeoutMs?: number;
  applicationName?: string;
  schema?: string;
}

/** Minimal shape of a `pg` query result used by the adapter. */
export interface PostgresQueryExecutionResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount?: number | null;
}

/** Shared queryable contract implemented by both pools and transaction clients. */
export interface IPostgresQueryable {
  query<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<PostgresQueryExecutionResult<T>>;
}

/** Transaction-scoped PostgreSQL client contract. */
export interface IPostgresTransactionClient extends IPostgresQueryable {
  release(): void;
}

/** PostgreSQL pool contract consumed by the adapter. */
export interface IPostgresPool extends IPostgresQueryable {
  connect(): Promise<IPostgresTransactionClient>;
  end(): Promise<void>;
}

/** Minimal driver module surface loaded from `pg`. */
export interface IPostgresDriverModule {
  Pool: new (config: Record<string, unknown>) => IPostgresPool;
}

/** Lazy loader that resolves the optional PostgreSQL dependency when needed. */
export type PostgresDriverLoader = () => Promise<IPostgresDriverModule>;

/** Injectable collaborators for testing or advanced composition. */
export interface PostgresAdapterDependencies {
  pool?: IPostgresPool;
  driverLoader?: PostgresDriverLoader;
}
