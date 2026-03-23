/**
 * @module @carpentry/db-postgres
 * @description Public entrypoint for the PostgreSQL adapter package.
 */
export { PostgresAdapter } from './postgresAdapter.js';
export type {
  IPostgresDriverModule,
  IPostgresPool,
  IPostgresQueryable,
  IPostgresTransactionClient,
  PostgresAdapterDependencies,
  PostgresConnectionConfig,
  PostgresDriverLoader,
  PostgresQueryExecutionResult,
} from './types.js';
export { compilePostgresQuery, createPostgresPoolConfig, normalizePostgresResult } from './helpers/compileQuery.js';
export { loadPostgresDriver } from './helpers/driverLoader.js';

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';
import { PostgresAdapter } from './postgresAdapter.js';
import type { PostgresConnectionConfig } from './types.js';

/**
 * DatabaseManager-compatible driver factory for the PostgreSQL adapter.
 *
 * @example
 * ```ts
 * import { postgresDriverFactory } from '@carpentry/db-postgres';
 * dbManager.registerDriver('postgres', postgresDriverFactory);
 * ```
 */
export const postgresDriverFactory: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new PostgresAdapter(config as unknown as PostgresConnectionConfig);
