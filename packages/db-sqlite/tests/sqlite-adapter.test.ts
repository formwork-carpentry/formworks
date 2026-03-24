import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SQLiteAdapter } from '../src/sqliteAdapter.js';
import type { ISQLiteDatabase, ISQLiteStatement, ISQLiteRunResult } from '../src/types.js';

function createMockDatabase(): ISQLiteDatabase {
  const mockStatement: ISQLiteStatement = {
    all: vi.fn().mockReturnValue([{ id: 1, name: 'Alice' }]),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 42 } as ISQLiteRunResult),
  };
  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    exec: vi.fn(),
    close: vi.fn(),
  };
}

describe('SQLiteAdapter', () => {
  let database: ReturnType<typeof createMockDatabase>;
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    database = createMockDatabase();
    adapter = new SQLiteAdapter(
      { database: ':memory:' },
      { database },
    );
  });

  it('should return driver name', () => {
    expect(adapter.driverName()).toBe('sqlite');
  });

  it('should execute a select query', async () => {
    const result = await adapter.execute({ sql: 'SELECT * FROM users', bindings: [], type: 'select' });
    expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
    expect(result.rowCount).toBe(1);
    expect(database.prepare).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('should execute an insert query', async () => {
    const result = await adapter.execute({
      sql: 'INSERT INTO users (name) VALUES (?)',
      bindings: ['Bob'],
      type: 'insert',
    });
    expect(result.rowCount).toBe(1);
    expect(result.insertId).toBe(42);
  });

  it('should execute schema (DDL) queries', async () => {
    await adapter.execute({
      sql: 'CREATE TABLE test (id INTEGER PRIMARY KEY)',
      bindings: [],
      type: 'schema',
    });
    expect(database.exec).toHaveBeenCalledWith('CREATE TABLE test (id INTEGER PRIMARY KEY)');
  });

  it('should execute raw SQL', async () => {
    const result = await adapter.raw('SELECT count(*) as cnt FROM users');
    expect(result.rows).toBeDefined();
  });

  it('should begin and commit transaction', async () => {
    await adapter.beginTransaction();
    expect(database.exec).toHaveBeenCalledWith('BEGIN');
    await adapter.commit();
    expect(database.exec).toHaveBeenCalledWith('COMMIT');
  });

  it('should begin and rollback transaction', async () => {
    await adapter.beginTransaction();
    await adapter.rollback();
    expect(database.exec).toHaveBeenCalledWith('ROLLBACK');
  });

  it('should disconnect', async () => {
    await adapter.disconnect();
    // database not owned, so close not called
    expect(database.close).not.toHaveBeenCalled();
  });

  it('should lazy-load driver when not injected', async () => {
    function MockDriver() { return database; }
    const mockDriverLoader = vi.fn().mockResolvedValue(MockDriver);
    const lazyAdapter = new SQLiteAdapter(
      { database: ':memory:' },
      { driverLoader: mockDriverLoader },
    );
    await lazyAdapter.connect();
    expect(mockDriverLoader).toHaveBeenCalled();
  });
});
