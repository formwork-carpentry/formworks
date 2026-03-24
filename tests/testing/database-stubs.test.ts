import { describe, expect, it } from 'vitest';

import {
  MongoDBAdapterStub,
  MySQLAdapterStub,
  PostgresAdapterStub,
  UnsupportedDriverAdapter,
} from '../../src/testing/database-stubs.js';

describe('testing/database-stubs', () => {
  it('re-exports all unsupported driver adapter stubs', async () => {
    const pg = new PostgresAdapterStub();
    const mysql = new MySQLAdapterStub();
    const mongo = new MongoDBAdapterStub();
    const custom = new UnsupportedDriverAdapter('custom', 'install me', 'cannot run', 'cannot execute');

    expect(pg.driverName()).toBe('postgres');
    expect(mysql.driverName()).toBe('mysql');
    expect(mongo.driverName()).toBe('mongodb');
    expect(custom.driverName()).toBe('custom');

    await expect(pg.connect()).rejects.toThrow('PostgreSQL driver is not installed');
    await expect(mysql.run('select 1')).rejects.toThrow('MySQL adapter is unavailable');
    await expect(mongo.raw('select 1')).rejects.toThrow('Not connected.');
    await expect(custom.execute({ sql: 'select 1', bindings: [], type: 'select' })).rejects.toThrow('cannot execute');
  });
});
