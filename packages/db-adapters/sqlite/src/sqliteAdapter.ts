/**
 * @module @formwork/db-sqlite/SQLiteAdapter
 * @description SQLite adapter backed by lazy `better-sqlite3` loading.
 * @patterns Adapter, Strategy
 */
import type {
  CompiledQuery,
  IDatabaseAdapter,
  ISQLiteDatabase,
  QueryResult,
  SQLiteAdapterDependencies,
  SQLiteConnectionConfig,
  SQLiteDriverLoader,
} from './types.js';
import { loadSQLiteDriver } from './helpers/driverLoader.js';
import { normalizeSQLiteInsertId, shouldReturnRows } from './helpers/results.js';

/**
 * SQLite adapter that loads `better-sqlite3` only when the driver is selected.
 */
export class SQLiteAdapter implements IDatabaseAdapter {
  private readonly config: SQLiteConnectionConfig;
  private database: ISQLiteDatabase | null;
  private readonly ownsDatabase: boolean;
  private readonly driverLoader: SQLiteDriverLoader;

  constructor(config: SQLiteConnectionConfig, dependencies: SQLiteAdapterDependencies = {}) {
    this.config = config;
    this.database = dependencies.database ?? null;
    this.ownsDatabase = dependencies.database === undefined;
    this.driverLoader = dependencies.driverLoader ?? loadSQLiteDriver;
  }

  /** @returns Driver name. */
  driverName(): string {
    return 'sqlite';
  }

  async connect(): Promise<void> {
    await this.ensureDatabase();
  }

  async disconnect(): Promise<void> {
    if (!this.database || !this.ownsDatabase) return;
    this.database.close();
    this.database = null;
  }

  async beginTransaction(): Promise<void> {
    const database = await this.ensureDatabase();
    database.exec('BEGIN');
  }

  async commit(): Promise<void> {
    const database = await this.ensureDatabase();
    database.exec('COMMIT');
  }

  async rollback(): Promise<void> {
    const database = await this.ensureDatabase();
    database.exec('ROLLBACK');
  }

  async execute<T = Record<string, unknown>>(query: CompiledQuery): Promise<QueryResult<T>> {
    const database = await this.ensureDatabase();
    if (shouldReturnRows(query)) {
      const rows = database.prepare(query.sql).all(...query.bindings) as T[];
      return { rows, rowCount: rows.length };
    }
    if (query.type === 'schema' && query.bindings.length === 0) {
      database.exec(query.sql);
      return { rows: [] as T[], rowCount: 0 };
    }
    const result = database.prepare(query.sql).run(...query.bindings);
    return {
      rows: [] as T[],
      rowCount: result.changes,
      insertId: normalizeSQLiteInsertId(result.lastInsertRowid),
    };
  }

  async raw<T = Record<string, unknown>>(sql: string, bindings: unknown[] = []): Promise<QueryResult<T>> {
    const type = /^\s*select\b/i.test(sql) ? 'select' : 'raw';
    return this.execute<T>({ sql, bindings, type });
  }

  private async ensureDatabase(): Promise<ISQLiteDatabase> {
    if (this.database) return this.database;
    const Driver = await this.driverLoader();
    this.database = new Driver(this.config.database, {
      readonly: this.config.readonly,
      fileMustExist: this.config.fileMustExist,
      timeout: this.config.timeoutMs,
    });
    return this.database;
  }
}
