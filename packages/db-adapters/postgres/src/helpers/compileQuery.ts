/**
 * @module @formwork/db-postgres/helpers/compileQuery
 * @description SQL compilation helpers for PostgreSQL placeholders and result normalization.
 */
import type { CompiledQuery, PostgresConnectionConfig, PostgresQueryExecutionResult, QueryResult } from '../types.js';

/**
 * Convert JDBC-style placeholders to PostgreSQL positional placeholders.
 *
 * @param query - Compiled query.
 * @returns PostgreSQL-compatible compiled query.
 */
export function compilePostgresQuery(query: CompiledQuery): CompiledQuery {
  let index = 0;
  let sql = query.sql.replace(/\?/g, () => `$${++index}`);
  if (query.type === 'insert' && !/\bRETURNING\b/i.test(sql)) {
    sql += ' RETURNING id';
  }
  return { ...query, sql };
}

/**
 * Normalize PostgreSQL results into the framework shape.
 *
 * @param query - Source query.
 * @param result - Driver result.
 * @returns Normalized result.
 */
export function normalizePostgresResult<T>(query: CompiledQuery, result: PostgresQueryExecutionResult<T>): QueryResult<T> {
  const rows = result.rows ?? [];
  const rowCount = result.rowCount ?? rows.length;
  const insertId = query.type === 'insert' ? inferInsertId(rows) : undefined;
  return { rows, rowCount, insertId };
}

/**
 * Build the driver pool configuration from Carpenter config.
 *
 * @param config - Connection config.
 * @returns Driver pool configuration.
 */
export function createPostgresPoolConfig(config: PostgresConnectionConfig): Record<string, unknown> {
  return {
    host: config.host,
    port: config.port ?? 5432,
    database: config.database,
    user: config.user ?? config.username,
    password: config.password,
    ssl: config.ssl,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeoutMs,
    statement_timeout: config.statementTimeoutMs,
    application_name: config.applicationName,
  };
}

function inferInsertId(rows: unknown[]): number | string | undefined {
  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== 'object' || !('id' in (firstRow as Record<string, unknown>))) {
    return undefined;
  }
  const identifier = (firstRow as Record<string, unknown>)['id'];
  if (typeof identifier === 'number' || typeof identifier === 'string') {
    return identifier;
  }
  return undefined;
}
