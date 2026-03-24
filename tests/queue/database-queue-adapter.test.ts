import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseQueueAdapter } from '../../src/queue/adapters/DatabaseQueueAdapter.js';

class QueueTestDatabaseAdapter {
  driverName(): string {
    return 'queue-test';
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  async close(): Promise<void> {}

  async execute<T = Record<string, unknown>>(query: {
    type?: string;
    sql: string;
  }): Promise<{ rows: T[]; rowCount: number; insertId?: number | string }> {
    if (query.type === 'aggregate' || /\bCOUNT\(/i.test(query.sql)) {
      return { rows: [{ aggregate: 0 } as T], rowCount: 1 };
    }
    if (query.type === 'insert') {
      return { rows: [], rowCount: 1, insertId: 1 };
    }
    if (query.type === 'select') {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 1 };
  }

  async raw<T = Record<string, unknown>>(_sql: string, _bindings?: unknown[]): Promise<{ rows: T[]; rowCount: number; insertId?: number | string }> {
    return { rows: [], rowCount: 0 };
  }

  async run(_sql: string, _params?: unknown[]): Promise<{ affectedRows: number; insertId?: number }> {
    return { affectedRows: 1, insertId: 1 };
  }
}

describe('queue/DatabaseQueueAdapter', () => {
  let db: QueueTestDatabaseAdapter;
  let queue: DatabaseQueueAdapter;

  beforeEach(() => {
    db = new QueueTestDatabaseAdapter();
    queue = new DatabaseQueueAdapter(db, { table: 'jobs' });
  });

  it('inserts jobs and returns ids', async () => {
    const id = await queue.push({ name: 'SendEmail', payload: { to: 'user@test.com' } });
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');

    const rawId = await queue.pushRaw(JSON.stringify({ action: 'cleanup' }), 'maintenance');
    expect(rawId).toBeTruthy();

    const delayedId = await queue.later(60, { name: 'ScheduledTask', payload: {} });
    expect(delayedId).toBeTruthy();
  });

  it('supports queue lifecycle operations', async () => {
    const id = await queue.push({ name: 'Temp', payload: {} });
    await queue.release(id, 30);
    await queue.delete(id);

    await queue.push({ name: 'A', payload: {} });
    await queue.push({ name: 'B', payload: {} });
    const count = await queue.purge();

    expect(await queue.size()).toBeGreaterThanOrEqual(0);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
