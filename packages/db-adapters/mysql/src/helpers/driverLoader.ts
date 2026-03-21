/**
 * @module @formwork/db-mysql/helpers/driverLoader
 * @description Lazy driver loading helpers for MySQL.
 */
import type { IMySQLDriverModule } from '../types.js';

/**
 * Load the optional `mysql2/promise` dependency on demand.
 *
 * @returns MySQL driver module.
 */
export async function loadMySQLDriver(): Promise<IMySQLDriverModule> {
  try {
    // mysql2 is installed as a dev dependency and should be available at runtime
    return await import('mysql2/promise') as unknown as IMySQLDriverModule;
  } catch (error) {
    throw createMissingDriverError('mysql2', 'npm install mysql2', error);
  }
}

function createMissingDriverError(packageName: string, installCommand: string, cause: unknown): Error {
  const message = `MySQLAdapter requires "${packageName}". Install it with: ${installCommand}`;
  const error = new Error(message);
  error.cause = cause;
  return error;
}
