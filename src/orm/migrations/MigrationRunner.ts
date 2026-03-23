/**
 * @module @carpentry/orm
 * @description MigrationRunner — executes and tracks migrations
 * @patterns Command (each migration is a command)
 */

import { Schema } from './Schema.js';
import type { IDatabaseAdapter } from '@carpentry/formworks/core/contracts';

export interface MigrationRecord {
  name: string;
  batch: number;
}

export interface MigrationClass {
  name: string;
  /**
   * @param {Schema} schema
   * @returns {Promise<void>}
   */
  up(schema: Schema): Promise<void>;
  /**
   * @param {Schema} schema
   * @returns {Promise<void>}
   */
  down(schema: Schema): Promise<void>;
}

/**
 * MigrationRunner — runs `up`/`down` on {@link MigrationClass} list and tracks batches.
 *
 * Persists ran migration names via the adapter (migrations table). Use with {@link Schema}
 * inside each migration's `up`/`down`.
 *
 * @example
 * ```ts
 * const runner = new MigrationRunner(adapter);
 * await runner.migrate([
 *   { name: '001_create_users', up: async (s) => { await s.create('users', (t) => { t.id(); t.string('email'); }); }, down: async (s) => { await s.dropIfExists('users'); } },
 * ]);
 * ```
 */
export class MigrationRunner {
  private schema: Schema;

  constructor(private adapter: IDatabaseAdapter) {
    this.schema = new Schema(adapter);
  }

  /** Run all pending migrations */
  /**
   * @param {MigrationClass[]} migrations
   * @returns {Promise<string[]>}
   */
  async migrate(migrations: MigrationClass[]): Promise<string[]> {
    await this.ensureMigrationsTable();
    const ran = await this.getRanMigrations();
    const pending = migrations.filter((m) => !ran.includes(m.name));

    if (pending.length === 0) return [];

    const batch = await this.getNextBatch();
    const migrated: string[] = [];

    for (const migration of pending) {
      await migration.up(this.schema);
      await this.recordMigration(migration.name, batch);
      migrated.push(migration.name);
    }

    return migrated;
  }

  /** Rollback the last batch of migrations */
  /**
   * @param {MigrationClass[]} migrations
   * @returns {Promise<string[]>}
   */
  async rollback(migrations: MigrationClass[]): Promise<string[]> {
    await this.ensureMigrationsTable();
    const lastBatch = await this.getLastBatch();
    if (lastBatch.length === 0) return [];

    const rolled: string[] = [];
    // Rollback in reverse order
    for (const record of lastBatch.reverse()) {
      const migration = migrations.find((m) => m.name === record.name);
      if (migration) {
        await migration.down(this.schema);
        rolled.push(migration.name);
      }
      await this.removeMigration(record.name);
    }

    return rolled;
  }

  /** Drop all tables and re-run all migrations */
  /**
   * @param {MigrationClass[]} migrations
   * @returns {Promise<string[]>}
   */
  async fresh(migrations: MigrationClass[]): Promise<string[]> {
    // Drop all tables (simplified — real impl would query information_schema)
    const ran = await this.getRanMigrations();
    for (const name of ran.reverse()) {
      const migration = migrations.find((m) => m.name === name);
      if (migration) await migration.down(this.schema);
    }
    await this.adapter.execute({ sql: 'DELETE FROM carpenter_migrations', bindings: [], type: 'raw' });
    return this.migrate(migrations);
  }

  /** Get list of already-run migration names */
  async getRanMigrations(): Promise<string[]> {
    const result = await this.adapter.execute<MigrationRecord>({
      sql: 'SELECT name FROM carpenter_migrations ORDER BY batch, name',
      bindings: [],
      type: 'select',
    });
    return result.rows.map((r) => r.name);
  }

  // ── Internal ────────────────────────────────────────────

  private async ensureMigrationsTable(): Promise<void> {
    await this.adapter.execute({
      sql: 'CREATE TABLE IF NOT EXISTS carpenter_migrations (name VARCHAR(255) NOT NULL, batch INTEGER NOT NULL)',
      bindings: [],
      type: 'schema',
    });
  }

  private async getNextBatch(): Promise<number> {
    const result = await this.adapter.execute<{ max_batch: number }>({
      sql: 'SELECT COALESCE(MAX(batch), 0) as max_batch FROM carpenter_migrations',
      bindings: [],
      type: 'select',
    });
    return (result.rows[0]?.max_batch ?? 0) + 1;
  }

  private async getLastBatch(): Promise<MigrationRecord[]> {
    const batchResult = await this.adapter.execute<{ max_batch: number }>({
      sql: 'SELECT COALESCE(MAX(batch), 0) as max_batch FROM carpenter_migrations',
      bindings: [],
      type: 'select',
    });
    const batch = batchResult.rows[0]?.max_batch ?? 0;
    if (batch === 0) return [];

    const result = await this.adapter.execute<MigrationRecord>({
      sql: 'SELECT name, batch FROM carpenter_migrations WHERE batch = ? ORDER BY name',
      bindings: [batch],
      type: 'select',
    });
    return result.rows;
  }

  private async recordMigration(name: string, batch: number): Promise<void> {
    await this.adapter.execute({
      sql: 'INSERT INTO carpenter_migrations (name, batch) VALUES (?, ?)',
      bindings: [name, batch],
      type: 'insert',
    });
  }

  private async removeMigration(name: string): Promise<void> {
    await this.adapter.execute({
      sql: 'DELETE FROM carpenter_migrations WHERE name = ?',
      bindings: [name],
      type: 'delete',
    });
  }
}
