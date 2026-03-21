import { postgresDriverFactory } from '@formwork/db-postgres';
import { mysqlAdapter } from '@formwork/db-mysql';
import { sqliteAdapter } from '@formwork/db-sqlite';
import { mongodbAdapter } from '@formwork/db-mongodb';
import { filesystemAdapter } from '@formwork/db-filesystem';
import { memoryAdapter } from '@formwork/db-memory';

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
  