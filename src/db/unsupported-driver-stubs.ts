/**
 * @module @carpentry/db
 * @description Stub IDatabaseAdapter implementations for missing native driver packages.
 */

import type { IDatabaseAdapter, CompiledQuery, QueryResult } from '../core/contracts';
import { DatabaseDriverDependencyError, DatabaseOperationError } from './exceptions/base.js';

export class UnsupportedDriverAdapter implements IDatabaseAdapter {
  constructor(
    private readonly name: string,
    private readonly connectMessage: string,
    private readonly runMessage: string,
    private readonly executeMessage = 'Not connected.',
  ) {}

  driverName(): string {
    return this.name;
  }

  async connect(): Promise<void> {
    throw new DatabaseDriverDependencyError(this.name, this.connectMessage);
  }

  async disconnect(): Promise<void> {}
  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  async close(): Promise<void> {
    await this.disconnect();
  }

  async run(_sql: string, _bindings: unknown[] = []): Promise<{ affectedRows: number; insertId?: number }> {
    throw new DatabaseOperationError(this.name, 'run', this.runMessage);
  }

  async execute<T = Record<string, unknown>>(_query: CompiledQuery): Promise<QueryResult<T>> {
    throw new DatabaseOperationError(this.name, 'execute', this.executeMessage);
  }

  async raw<T = Record<string, unknown>>(_sql: string, _bindings?: unknown[]): Promise<QueryResult<T>> {
    throw new DatabaseOperationError(this.name, 'raw', this.executeMessage);
  }
}

export class PostgresAdapterStub extends UnsupportedDriverAdapter {
  constructor() {
    super('postgres', 'PostgreSQL driver is not installed. Run: npm install pg', 'PostgreSQL adapter is unavailable.');
  }
}

export class MySQLAdapterStub extends UnsupportedDriverAdapter {
  constructor() {
    super('mysql', 'MySQL driver is not installed. Run: npm install mysql2', 'MySQL adapter is unavailable.');
  }
}

export class MongoDBAdapterStub extends UnsupportedDriverAdapter {
  constructor() {
    super('mongodb', 'MongoDB driver is not installed. Run: npm install mongodb', 'MongoDB adapter is unavailable.');
  }
}
