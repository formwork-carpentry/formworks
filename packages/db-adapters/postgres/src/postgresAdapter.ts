/**
 * @module @formwork/db-postgres/PostgresAdapter
 * @description PostgreSQL adapter backed by a lazily loaded `pg` pool.
 * @patterns Adapter, Strategy
 */
import type {
  CompiledQuery,
  IDatabaseAdapter,
  IPostgresPool,
  IPostgresTransactionClient,
  PostgresAdapterDependencies,
  PostgresConnectionConfig,
  PostgresDriverLoader,
  QueryResult,
} from './types.js';
import { compilePostgresQuery, createPostgresPoolConfig, normalizePostgresResult } from './helpers/compileQuery.js';
import { loadPostgresDriver } from './helpers/driverLoader.js';

/**
 * PostgreSQL adapter backed by a lazily loaded `pg` pool.
 */
export class PostgresAdapter implements IDatabaseAdapter {
  private readonly config: PostgresConnectionConfig;
  private pool: IPostgresPool | null;
  private transactionClient: IPostgresTransactionClient | null = null;
  private readonly ownsPool: boolean;
  private readonly driverLoader: PostgresDriverLoader;

  constructor(config: PostgresConnectionConfig, dependencies: PostgresAdapterDependencies = {}) {
    this.config = config;
    this.pool = dependencies.pool ?? null;
    this.ownsPool = dependencies.pool === undefined;
    this.driverLoader = dependencies.driverLoader ?? loadPostgresDriver;
  }

  driverName(): string {
    return 'postgres';
  }

  async connect(): Promise<void> {
    await this.ensurePool();
  }

  async disconnect(): Promise<void> {
    this.releaseTransactionClient();
    if (!this.pool || !this.ownsPool) return;
    await this.pool.end();
    this.pool = null;
  }

  async beginTransaction(): Promise<void> {
    if (this.transactionClient) {
      throw new Error('A PostgreSQL transaction is already active.');
    }
    const pool = await this.ensurePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      this.transactionClient = client;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async commit(): Promise<void> {
    const client = this.requireTransactionClient();
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
      this.transactionClient = null;
    }
  }

  async rollback(): Promise<void> {
    const client = this.requireTransactionClient();
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
      this.transactionClient = null;
    }
  }

  async execute<T = Record<string, unknown>>(query: CompiledQuery): Promise<QueryResult<T>> {
    const executor = this.transactionClient ?? await this.ensurePool();
    const compiled = compilePostgresQuery(query);
    const result = await executor.query<T>(compiled.sql, compiled.bindings);
    return normalizePostgresResult<T>(query, result);
  }

  async raw<T = Record<string, unknown>>(sql: string, bindings: unknown[] = []): Promise<QueryResult<T>> {
    return this.execute<T>({ sql, bindings, type: 'raw' });
  }

  private async ensurePool(): Promise<IPostgresPool> {
    if (this.pool) return this.pool;
    const driver = await this.driverLoader();
    this.pool = new driver.Pool(createPostgresPoolConfig(this.config));
    return this.pool;
  }

  private requireTransactionClient(): IPostgresTransactionClient {
    if (!this.transactionClient) {
      throw new Error('No active PostgreSQL transaction.');
    }
    return this.transactionClient;
  }

  private releaseTransactionClient(): void {
    if (!this.transactionClient) return;
    this.transactionClient.release();
    this.transactionClient = null;
  }
}
