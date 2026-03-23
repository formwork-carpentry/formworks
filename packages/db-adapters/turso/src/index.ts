/**
 * @module @carpentry/db-turso
 * @description TursoDatabaseAdapter — connects to Turso (libSQL) edge databases.
 * Turso is a SQLite-compatible database built on libSQL with edge replication.
 *
 * @patterns Adapter (implements IDatabaseAdapter via @libsql/client)
 * @principles LSP (substitutable for SQLite/Postgres/MySQL), SRP (Turso ops only)
 *
 * @example
 * ```ts
 * import { TursoDatabaseAdapter } from '@carpentry/db-turso';
 *
 * const db = new TursoDatabaseAdapter({
 *   url: 'libsql://my-db-myorg.turso.io',
 *   authToken: process.env.TURSO_AUTH_TOKEN!,
 * });
 *
 * const users = await db.query('SELECT * FROM users WHERE active = ?', [true]);
 * ```
 */

import type { TursoConfig } from './types.js';

export { type TursoConfig } from './types.js';

/** Turso/libSQL database adapter. */
export class TursoDatabaseAdapter {
  private readonly config: TursoConfig;

  constructor(config: TursoConfig) {
    this.config = config;
  }

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
    void sql; void params;
    throw new Error('TursoDatabaseAdapter.query() not yet implemented — install @libsql/client');
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }> {
    void sql; void params;
    throw new Error('TursoDatabaseAdapter.execute() not yet implemented');
  }

  async close(): Promise<void> {
    throw new Error('TursoDatabaseAdapter.close() not yet implemented');
  }
}

/**
 * DatabaseManager-compatible driver factory for the Turso adapter.
 */
export const tursoAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new TursoDatabaseAdapter(config as unknown as TursoConfig);
