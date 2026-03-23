/**
 * @module @carpentry/db-postgres/helpers/driverLoader
 * @description Lazy driver loading helpers for PostgreSQL.
 */
import type { IPostgresDriverModule } from '../types.js';

/**
 * Load the optional `pg` dependency on demand.
 *
 * @returns PostgreSQL driver module.
 */
export async function loadPostgresDriver(): Promise<IPostgresDriverModule> {
  try {
    // pg is installed as a dev dependency and should be available at runtime
    return await import('pg') as unknown as IPostgresDriverModule;
  } catch (error) {
    throw createMissingDriverError('pg', 'npm install pg', error);
  }
}

function createMissingDriverError(packageName: string, installCommand: string, cause: unknown): Error {
  const message = `PostgresAdapter requires "${packageName}". Install it with: ${installCommand}`;
  const error = new Error(message);
  error.cause = cause;
  return error;
}
