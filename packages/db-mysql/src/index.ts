/**
 * @module @carpentry/db-mysql
 * @description Public entrypoint for the MySQL adapter package.
 */
export { MySQLAdapter } from './mysqlAdapter.js';
export type {
  IMySQLDriverModule,
  IMySQLExecutable,
  IMySQLPool,
  IMySQLResultHeader,
  IMySQLTransactionConnection,
  MySQLAdapterDependencies,
  MySQLConnectionConfig,
  MySQLDriverLoader,
} from './types.js';
export { createMySQLPoolConfig, normalizeMySQLResult } from './helpers/results.js';
export { loadMySQLDriver } from './helpers/driverLoader.js';

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';
import { MySQLAdapter } from './mysqlAdapter.js';
import type { MySQLConnectionConfig } from './types.js';

/**
 * DatabaseManager-compatible driver factory for the MySQL adapter.
 *
 * @example
 * ```ts
 * import { mysqlAdapter } from '@carpentry/db-mysql';
 * dbManager.registerDriver('mysql', mysqlAdapter);
 * ```
 */
export const mysqlAdapter: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new MySQLAdapter(config as unknown as MySQLConnectionConfig);
