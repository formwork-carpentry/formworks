import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MySQLAdapter } from '../src/mysqlAdapter.js';
import type { IMySQLPool, IMySQLTransactionConnection, IMySQLResultHeader } from '../src/types.js';

function createMockPool(): IMySQLPool & { _connection: IMySQLTransactionConnection } {
  const mockConnection: IMySQLTransactionConnection = {
    execute: vi.fn().mockResolvedValue([[{ id: 1 }], []]),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
  return {
    execute: vi.fn().mockResolvedValue([[{ id: 1, name: 'Alice' }], []]),
    getConnection: vi.fn().mockResolvedValue(mockConnection),
    end: vi.fn().mockResolvedValue(undefined),
    _connection: mockConnection,
  };
}

describe('MySQLAdapter', () => {
  let pool: ReturnType<typeof createMockPool>;
  let adapter: MySQLAdapter;

  beforeEach(() => {
    pool = createMockPool();
    adapter = new MySQLAdapter(
      { host: 'localhost', port: 3306, database: 'test', user: 'root', password: '' },
      { pool },
    );
  });

  it('should return driver name', () => {
    expect(adapter.driverName()).toBe('mysql');
  });

  it('should execute a query', async () => {
    const result = await adapter.execute({ sql: 'SELECT * FROM users', bindings: [], type: 'select' });
    expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
    expect(pool.execute).toHaveBeenCalled();
  });

  it('should execute raw SQL', async () => {
    const result = await adapter.raw('SELECT 1');
    expect(result.rows).toBeDefined();
  });

  it('should begin and commit transaction', async () => {
    await adapter.beginTransaction();
    expect(pool._connection.beginTransaction).toHaveBeenCalled();
    await adapter.commit();
    expect(pool._connection.commit).toHaveBeenCalled();
    expect(pool._connection.release).toHaveBeenCalled();
  });

  it('should begin and rollback transaction', async () => {
    await adapter.beginTransaction();
    await adapter.rollback();
    expect(pool._connection.rollback).toHaveBeenCalled();
    expect(pool._connection.release).toHaveBeenCalled();
  });

  it('should throw if transaction already active', async () => {
    await adapter.beginTransaction();
    await expect(adapter.beginTransaction()).rejects.toThrow('already active');
  });

  it('should throw when committing without transaction', async () => {
    await expect(adapter.commit()).rejects.toThrow('No active');
  });

  it('should disconnect without error', async () => {
    await adapter.disconnect();
    expect(pool.end).not.toHaveBeenCalled();
  });

  it('should lazy-load pool when not injected', async () => {
    const mockDriverLoader = vi.fn().mockResolvedValue({
      createPool: vi.fn().mockReturnValue(pool),
    });
    const lazyAdapter = new MySQLAdapter(
      { host: 'localhost', database: 'test', user: 'root', password: '' },
      { driverLoader: mockDriverLoader },
    );
    await lazyAdapter.connect();
    expect(mockDriverLoader).toHaveBeenCalled();
  });
});
