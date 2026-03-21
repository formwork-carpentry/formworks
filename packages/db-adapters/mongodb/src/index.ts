/**
 * @module @formwork/db-mongodb
 * @description Public entrypoint for the MongoDB document adapter package.
 */
export { MongoDBAdapter } from './mongoDBAdapter.js';
export type {
  IMongoClient,
  IMongoCollection,
  IMongoCursor,
  IMongoDatabase,
  IMongoDeleteResult,
  IMongoDriverModule,
  IMongoInsertOneResult,
  IMongoUpdateResult,
  MongoDBAdapterDependencies,
  MongoDBConnectionConfig,
  MongoDriverLoader,
} from './types.js';
export { loadMongoDriver } from './helpers/driverLoader.js';
export {
  normalizeInsertedId,
  resolveCollectionName,
  toMongoFilter,
  toMongoSort,
} from './helpers/query.js';

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@formwork/core/adapters';
import { MongoDBAdapter } from './mongoDBAdapter.js';
import type { MongoDBConnectionConfig } from './types.js';

/**
 * DatabaseManager-compatible driver factory for the MongoDB adapter.
 *
 * @example
 * ```ts
 * import { mongodbAdapter } from '@formwork/db-mongodb';
 * dbManager.registerDriver('mongodb', mongodbAdapter);
 * ```
 */
export const mongodbAdapter: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new MongoDBAdapter(config as unknown as MongoDBConnectionConfig);
