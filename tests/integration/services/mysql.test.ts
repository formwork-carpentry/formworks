import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MySQLAdapter } from '@carpentry/db-mysql';
import { MYSQL_CONFIG } from './support.js';

describe('real-services/MySQLAdapter', { timeout: 15_000 }, () => {
  let adapter: MySQLAdapter;

  beforeAll(async () => {
    adapter = new MySQLAdapter(MYSQL_CONFIG);
    await adapter.connect();
    await adapter.raw(
      'CREATE TABLE IF NOT EXISTS _carpenter_mysql_test (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(255) NOT NULL)',
    );
    await adapter.raw('DELETE FROM _carpenter_mysql_test');
  });

  afterAll(async () => {
    await adapter.raw('DROP TABLE IF EXISTS _carpenter_mysql_test');
    await adapter.disconnect();
  });

  it('responds to ping and CRUD/transaction operations', async () => {
    const ping = await adapter.raw<{ ping: number }>('SELECT 1 AS ping');
    expect(ping.rows[0]).toEqual({ ping: 1 });

    await adapter.execute({
      sql: 'INSERT INTO _carpenter_mysql_test (label) VALUES (?)',
      bindings: ['hello_mysql'],
      type: 'insert',
    });
    const inserted = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_mysql_test WHERE label = 'hello_mysql'",
    );
    expect(inserted.rows).toHaveLength(1);

    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_mysql_test (label) VALUES (?)',
      bindings: ['txn_commit_mysql'],
      type: 'insert',
    });
    await adapter.commit();
    const committed = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_mysql_test WHERE label = 'txn_commit_mysql'",
    );
    expect(committed.rows).toHaveLength(1);

    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_mysql_test (label) VALUES (?)',
      bindings: ['txn_rollback_mysql'],
      type: 'insert',
    });
    await adapter.rollback();
    const rolledBack = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_mysql_test WHERE label = 'txn_rollback_mysql'",
    );
    expect(rolledBack.rows).toHaveLength(0);
  });
});
