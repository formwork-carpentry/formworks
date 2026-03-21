/**
 * @module @formwork/db-mongodb/helpers/driverLoader
 * @description Lazy driver loading helpers for the MongoDB document adapter.
 */
import type { IMongoDriverModule } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<IMongoDriverModule>;

/**
 * Load the optional `mongodb` driver package on demand.
 *
 * @returns MongoDB driver module.
 */
export async function loadMongoDriver(): Promise<IMongoDriverModule> {
  try {
    return await dynamicImport('mongodb');
  } catch (error) {
    throw createMissingDriverError('mongodb', 'npm install mongodb', error);
  }
}

function createMissingDriverError(packageName: string, installCommand: string, cause: unknown): Error {
  const message = `MongoDBAdapter requires "${packageName}". Install it with: ${installCommand}`;
  const error = new Error(message);
  error.cause = cause;
  return error;
}
