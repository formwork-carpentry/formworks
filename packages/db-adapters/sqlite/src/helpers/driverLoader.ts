/**
 * @module @formwork/db-sqlite/helpers/driverLoader
 * @description Lazy driver loading helpers for the SQLite adapter.
 */
import type { SQLiteDriverConstructor } from '../types.js';
import {} from '@formwork/core/exceptions';

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ default?: SQLiteDriverConstructor }>;

/**
 * Load the optional `better-sqlite3` dependency on demand.
 *
 * @returns SQLite driver constructor.
 */
export async function loadSQLiteDriver(): Promise<SQLiteDriverConstructor> {
  try {
    const loaded = await dynamicImport('better-sqlite3');
    const candidate = loaded.default ?? loaded;
    return candidate as SQLiteDriverConstructor;
  } catch (error) {
    throw createMissingDriverError('better-sqlite3', 'npm install better-sqlite3', error);
  }
}

function createMissingDriverError(packageName: string, installCommand: string, cause: unknown): Error {
  const message = `SQLiteAdapter requires "${packageName}". Install it with: ${installCommand}`;
  const error = new Error(message);
  error.cause = cause;
  return error;
}
