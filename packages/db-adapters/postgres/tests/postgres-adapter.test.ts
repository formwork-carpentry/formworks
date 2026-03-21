import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostgresAdapter } from '../src/postgresAdapter.js';
import type { IPostgresPool, IPostgresTransactionClient } from '../src/types.js';

function createMockPool(): IPostgresPool {
  const mockClient: IPostgresTransactionClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ id: 1, name: 'Alice' }], rowCount: 1 }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PostgresAdapter', () => {
  let pool: ReturnType<typeof createMockPool>;
  let adapter: PostgresAdapter;

  beforeEach(() => {
    pool = createMockPool();
    adapter = new PostgresAdapter(
      { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test' },
      { pool },
    );
  });

  it('should return driver name', () => {
    expect(adapter.driverName()).toBe('postgres');
  });

  it('should execute a select query', async () => {
    const result = await adapter.execute({ sql: 'SELECT * FROM users', bindings: [], type: 'select' });
    expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
    expect(pool.query).toHaveBeenCalled();
  });

  it('should execute raw SQL', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ count: 5 }], rowCount: 1 });
    const result = await adapter.raw('SELECT count(*) FROM users');
    expect(result.rows).toEqual([{ count: 5 }]);
  });

  it('should begin and commit transaction', async () => {
    await adapter.beginTransaction();
    const client = await pool.connect();
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    await adapter.commit();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('should begin and rollback transaction', async () => {
    await adapter.beginTransaction();
    const client = await pool.connect();
    await adapter.rollback();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('should throw if transaction already active', async () => {
    await adapter.beginTransaction();
    await expect(adapter.beginTransaction()).rejects.toThrow('already active');
  });

  it('should throw when committing without transaction', async () => {
    await expect(adapter.commit()).rejects.toThrow('No active');
  });

  it('should disconnect', async () => {
    await adapter.disconnect();
    // pool not owned, so end not called
    expect(pool.end).not.toHaveBeenCalled();
  });

  it('should lazy-load pool when not injected', async () => {
    function MockPool() { return pool; }
    const mockDriverLoader = vi.fn().mockResolvedValue({ Pool: MockPool });
    const lazyAdapter = new PostgresAdapter(
      { host: 'localhost', database: 'test', user: 'test', password: 'test' },
      { driverLoader: mockDriverLoader },
    );
    await lazyAdapter.connect();
    expect(mockDriverLoader).toHaveBeenCalled();
  });
});
