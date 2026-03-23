import { postgresDriverFactory } from '@carpentry/db-postgres';
import { mysqlAdapter } from '@carpentry/db-mysql';
import { sqliteAdapter } from '@carpentry/db-sqlite';
import { mongodbAdapter } from '@carpentry/db-mongodb';
import { filesystemAdapter } from '@carpentry/db-filesystem';
import { memoryAdapter } from '@carpentry/db-memory';

import {
  DatabaseManager,
  type DatabaseConnectionConfig,
  type DatabaseDriverFactory,
} from './databaseManager.js';


export function createDatabaseManager(
  defaultConnection: string,
  configs: Record<string, DatabaseConnectionConfig>,
): DatabaseManager {
  const manager = new DatabaseManager(defaultConnection, configs);
  // registerDriver stores factories; the per-connection config is passed later
  // by DatabaseManager.resolve()/connection() when a named connection is requested.
  manager.registerDriver('memory', memoryAdapter as DatabaseDriverFactory);
  manager.registerDriver('postgres', postgresDriverFactory as DatabaseDriverFactory);
  manager.registerDriver('mysql', mysqlAdapter as DatabaseDriverFactory);
  manager.registerDriver('sqlite', sqliteAdapter as DatabaseDriverFactory);
  manager.registerDriver('mongodb', mongodbAdapter as DatabaseDriverFactory);
  manager.registerDriver('filesystem', filesystemAdapter as DatabaseDriverFactory);
  return manager;
}
  