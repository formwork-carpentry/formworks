/**
 * @module @carpentry/db-mysql/MySQLAdapter
 * @description MySQL adapter backed by a lazily loaded `mysql2` pool.
 * @patterns Adapter, Strategy
 */
import type {
  CompiledQuery,
  IDatabaseAdapter,
  IMySQLPool,
  IMySQLTransactionConnection,
  MySQLAdapterDependencies,
  MySQLConnectionConfig,
  MySQLDriverLoader,
  QueryResult,
} from './types.js';
import { loadMySQLDriver } from './helpers/driverLoader.js';
import { createMySQLPoolConfig, normalizeMySQLResult } from './helpers/results.js';

/**
 * MySQL adapter backed by a lazily loaded `mysql2` pool.
 */
export class MySQLAdapter implements IDatabaseAdapter {
  private readonly config: MySQLConnectionConfig;
  private pool: IMySQLPool | null;
  private transactionConnection: IMySQLTransactionConnection | null = null;
  private readonly ownsPool: boolean;
  private readonly driverLoader: MySQLDriverLoader;

  constructor(config: MySQLConnectionConfig, dependencies: MySQLAdapterDependencies = {}) {
    this.config = config;
    this.pool = dependencies.pool ?? null;
    this.ownsPool = dependencies.pool === undefined;
    this.driverLoader = dependencies.driverLoader ?? loadMySQLDriver;
  }

  driverName(): string {
    return 'mysql';
  }

  async connect(): Promise<void> {
    await this.ensurePool();
  }

  async disconnect(): Promise<void> {
    this.releaseTransactionConnection();
    if (!this.pool || !this.ownsPool) return;
    await this.pool.end();
    this.pool = null;
  }

  async beginTransaction(): Promise<void> {
    if (this.transactionConnection) {
      throw new Error('A MySQL transaction is already active.');
    }
    const pool = await this.ensurePool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      this.transactionConnection = connection;
    } catch (error) {
      connection.release();
      throw error;
    }
  }

  async commit(): Promise<void> {
    const connection = this.requireTransactionConnection();
    try {
      await connection.commit();
    } finally {
      connection.release();
      this.transactionConnection = null;
    }
  }

  async rollback(): Promise<void> {
    const connection = this.requireTransactionConnection();
    try {
      await connection.rollback();
    } finally {
      connection.release();
      this.transactionConnection = null;
    }
  }

  async execute<T = Record<string, unknown>>(query: CompiledQuery): Promise<QueryResult<T>> {
    const executor = this.transactionConnection ?? await this.ensurePool();
    const [payload] = await executor.execute<T>(query.sql, query.bindings);
    return normalizeMySQLResult<T>(payload);
  }

  async raw<T = Record<string, unknown>>(sql: string, bindings: unknown[] = []): Promise<QueryResult<T>> {
    return this.execute<T>({ sql, bindings, type: 'raw' });
  }

  private async ensurePool(): Promise<IMySQLPool> {
    if (this.pool) return this.pool;
    const driver = await this.driverLoader();
    this.pool = driver.createPool(createMySQLPoolConfig(this.config));
    return this.pool;
  }

  private requireTransactionConnection(): IMySQLTransactionConnection {
    if (!this.transactionConnection) {
      throw new Error('No active MySQL transaction.');
    }
    return this.transactionConnection;
  }

  private releaseTransactionConnection(): void {
    if (!this.transactionConnection) return;
    this.transactionConnection.release();
    this.transactionConnection = null;
  }
}
