/**
 * @module @carpentry/db
 * @description Manager API barrel for database resolution.
 */

import {
  type DatabaseConnectionConfig,
  type DatabaseDriverFactory,
  DatabaseManager,
  createDatabaseManager,
} from "../adapters/index.js";

export {
  DatabaseManager,
  createDatabaseManager,
  type DatabaseConnectionConfig,
  type DatabaseDriverFactory,
};
