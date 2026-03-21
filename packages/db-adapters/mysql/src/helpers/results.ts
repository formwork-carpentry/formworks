/**
 * @module @formwork/db-mysql/helpers/results
 * @description Result normalization and config helpers for the MySQL adapter.
 */
import type { IMySQLResultHeader, MySQLConnectionConfig, QueryResult } from '../types.js';

/**
 * Normalize MySQL driver payloads into Carpenter query results.
 *
 * @param payload - Driver payload.
 * @returns Normalized query result.
 */
export function normalizeMySQLResult<T>(payload: T[] | IMySQLResultHeader): QueryResult<T> {
  if (Array.isArray(payload)) {
    return { rows: payload, rowCount: payload.length };
  }
  return {
    rows: [] as T[],
    rowCount: payload.affectedRows,
    insertId: payload.insertId,
  };
}

/**
 * Build the MySQL pool configuration from Carpenter config.
 *
 * @param config - Connection config.
 * @returns Driver pool config.
 */
export function createMySQLPoolConfig(config: MySQLConnectionConfig): Record<string, unknown> {
  return {
    host: config.host,
    port: config.port ?? 3306,
    database: config.database,
    user: config.user ?? config.username,
    password: config.password,
    connectionLimit: config.connectionLimit,
    waitForConnections: config.waitForConnections,
    queueLimit: config.queueLimit,
    charset: config.charset,
    timezone: config.timezone,
  };
}
