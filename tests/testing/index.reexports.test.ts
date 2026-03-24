import { describe, expect, it } from 'vitest';

import {
  MongoDBAdapterStub,
  MySQLAdapterStub,
  PostgresAdapterStub,
  UnsupportedDriverAdapter,
} from '../../src/testing/index.js';

describe('testing/index re-exports', () => {
  it('re-exports unsupported database adapter stubs', async () => {
    const pg = new PostgresAdapterStub();
    const mysql = new MySQLAdapterStub();
    const mongo = new MongoDBAdapterStub();
    const custom = new UnsupportedDriverAdapter('x', 'need dep', 'cannot run');

    expect(pg.driverName()).toBe('postgres');
    expect(mysql.driverName()).toBe('mysql');
    expect(mongo.driverName()).toBe('mongodb');
    expect(custom.driverName()).toBe('x');

    await expect(pg.connect()).rejects.toThrow('PostgreSQL driver is not installed');
    await expect(mysql.run('select 1')).rejects.toThrow('MySQL adapter is unavailable');
    await expect(mongo.execute({ sql: 'x', bindings: [], type: 'select' })).rejects.toThrow('Not connected.');
  });
});
