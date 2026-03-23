import { describe, it, expect } from 'vitest';

import { postgresDriverFactory } from '../../db-adapters/postgres/src/index.js';
import { mysqlAdapter } from '../../db-adapters/mysql/src/index.js';
import { sqliteAdapter } from '../../db-adapters/sqlite/src/index.js';
import { mongodbAdapter } from '../../db-adapters/mongodb/src/index.js';
import { filesystemAdapter } from '../../db-adapters/filesystem/src/index.js';
import { memoryAdapter } from '../../db-adapters/memorydb/src/index.js';

describe('@carpentry/db adapter package exports', () => {
  it('creates a postgres adapter from its factory', () => {
    const adapter = postgresDriverFactory({
      driver: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'app',
      user: 'user',
      password: 'pass',
    });
    expect(adapter.driverName()).toBe('postgres');
  });

  it('creates a mysql adapter from its factory', () => {
    const adapter = mysqlAdapter({
      driver: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'app',
      user: 'user',
      password: 'pass',
    });
    expect(adapter.driverName()).toBe('mysql');
  });

  it('creates a sqlite adapter from its factory', () => {
    const adapter = sqliteAdapter({
      driver: 'sqlite',
      database: ':memory:',
    });
    expect(adapter.driverName()).toBe('sqlite');
  });

  it('creates a mongodb document adapter from its factory', () => {
    const adapter = mongodbAdapter({
      driver: 'mongodb',
      url: 'mongodb://localhost:27017',
      database: 'app',
      collection: 'users',
    });
    expect(adapter.driverName()).toBe('mongodb');
  });

  it('creates a filesystem document adapter from its factory', () => {
    const adapter = filesystemAdapter({
      driver: 'filesystem',
      file: '/tmp/db.json',
    });
    expect(adapter.driverName()).toBe('filesystem');
  });

  it('creates an in-memory adapter from its factory', () => {
    const adapter = memoryAdapter({ driver: 'memory' });
    expect(adapter.driverName()).toBe('sqlite-memory');
  });
});
