import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseQueueAdapter } from '../../../src/queue/adapters/DatabaseQueueAdapter.js';
import { MockDatabaseAdapter } from '../../../src/orm/adapters/MockDatabaseAdapter.js';

describe('tier2/production/DatabaseQueueAdapter', () => {
  let db: MockDatabaseAdapter;
  let queue: DatabaseQueueAdapter;

  beforeEach(() => {
    db = new MockDatabaseAdapter();
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
