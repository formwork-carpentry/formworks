/**
 * @module @formwork/db
 * @description Database adapters — public entry for `@formwork/db`.
 *
 * **Layout (SOLID / separation of concerns):**
 * - {@link CompiledQuery} / {@link QueryResult} — shared adapter types (`./types`)
 * - {@link SQLiteMemoryAdapter} — in-memory test driver, no native deps (`./sqlite-memory-adapter`)
 * - {@link UnsupportedDriverAdapter} + stub adapters — placeholders until real packages ship (`./unsupported-driver-stubs`)
 * - {@link DatabaseManager} — multi-connection resolution (`./DatabaseManager`)
 *
 * Driver-specific **implementations** (pg, mysql2, mongodb, native sqlite) are intended to live in
 * `@formwork/db-postgres`, `@formwork/db-mysql`, etc., and register via `DatabaseManager.registerDriver`.
 * This package keeps the default/test surface small.
 *
 * @example
 * ```ts
 * import { SQLiteMemoryAdapter } from '@formwork/db';
 *
 * const db = new SQLiteMemoryAdapter();
 * await db.execute({ sql: 'CREATE TABLE users (id, name)', bindings: [], type: 'schema' });
 * ```
 *
 * @patterns Adapter (each normalizes a DB driver to IDatabaseAdapter)
 * @principles LSP — adapters substitutable; DIP — ORM depends on IDatabaseAdapter
 */

export type { CompiledQueryType, CompiledQuery, QueryResult } from './types/index.js';
export {
  UnsupportedDriverAdapter,
  PostgresAdapterStub,
  MySQLAdapterStub,
  MongoDBAdapterStub,
} from './unsupported-driver-stubs.js';
export * from './exceptions.js';
export {
  DatabaseManager,
  createDatabaseManager,
  type DatabaseConnectionConfig,
  type DatabaseDriverFactory,
} from './factory/index.js';

