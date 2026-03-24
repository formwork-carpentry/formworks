/**
 * @module @carpentry/db-sqlite
 * @description Public entrypoint for the SQLite adapter package.
 */
export { SQLiteAdapter } from './sqliteAdapter.js';
export type {
  ISQLiteDatabase,
  ISQLiteRunResult,
  ISQLiteStatement,
  SQLiteAdapterDependencies,
  SQLiteConnectionConfig,
  SQLiteDriverConstructor,
  SQLiteDriverLoader,
} from './types.js';
export { loadSQLiteDriver } from './helpers/driverLoader.js';
export { normalizeSQLiteInsertId, shouldReturnRows } from './helpers/results.js';

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';
import { SQLiteAdapter } from './sqliteAdapter.js';
import type { SQLiteConnectionConfig } from './types.js';

/**
 * DatabaseManager-compatible driver factory for the SQLite adapter.
 *
 * @example
 * ```ts
 * import { sqliteAdapter } from '@carpentry/db-sqlite';
 * import { CarpenterFactoryAdapter } from '@carpentry/core/adapters';
 * dbManager.registerDriver('sqlite', sqliteAdapter);
 * ```
 */
export const sqliteAdapter: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new SQLiteAdapter(config as unknown as SQLiteConnectionConfig);
