import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresAdapter } from '@carpentry/db-postgres';
import { PG_CONFIG } from './support.js';

describe('real-services/PostgresAdapter', { timeout: 15_000 }, () => {
  let adapter: PostgresAdapter;

  beforeAll(async () => {
    adapter = new PostgresAdapter(PG_CONFIG);
    await adapter.connect();
    await adapter.raw(
      'CREATE TABLE IF NOT EXISTS _carpenter_pg_test (id SERIAL PRIMARY KEY, label TEXT NOT NULL)',
    );
    await adapter.raw('DELETE FROM _carpenter_pg_test');
  });

  afterAll(async () => {
    await adapter.raw('DROP TABLE IF EXISTS _carpenter_pg_test');
    await adapter.disconnect();
  });

  it('responds to ping and CRUD/transaction operations', async () => {
    const ping = await adapter.raw<{ ping: number }>('SELECT 1 AS ping');
    expect(ping.rows[0]).toEqual({ ping: 1 });

    await adapter.execute({
      sql: 'INSERT INTO _carpenter_pg_test (label) VALUES ($1)',
      bindings: ['hello_postgres'],
      type: 'insert',
    });
    const inserted = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_pg_test WHERE label = 'hello_postgres'",
    );
    expect(inserted.rows).toHaveLength(1);

    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_pg_test (label) VALUES ($1)',
      bindings: ['txn_commit'],
      type: 'insert',
    });
    await adapter.commit();
    const committed = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_pg_test WHERE label = 'txn_commit'",
    );
    expect(committed.rows).toHaveLength(1);

    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_pg_test (label) VALUES ($1)',
      bindings: ['txn_rollback'],
      type: 'insert',
    });
    await adapter.rollback();
    const rolledBack = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_pg_test WHERE label = 'txn_rollback'",
    );
    expect(rolledBack.rows).toHaveLength(0);
  });
});
