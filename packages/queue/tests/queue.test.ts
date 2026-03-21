/**
 * @module @formwork/queue
 * @description Tests for Queue system (CARP-026)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseJob, SyncQueueAdapter, MemoryQueueAdapter } from '../src/adapters/Adapters.js';
import { QueueManager, setQueueManager, Queue, dispatch } from '../src/manager/QueueManager.js';

// ── BaseJob ───────────────────────────────────────────────

class SendEmailJob extends BaseJob<{ to: string; subject: string }> {
  static queue = 'emails';
  static maxTries = 5;

  async handle(payload: { to: string; subject: string }): Promise<void> {
    // In real impl, this would send an email
  }
}

describe('CARP-026: BaseJob', () => {
  it('toQueuedJob() creates a QueuedJob from class metadata', () => {
    const job = SendEmailJob.toQueuedJob({ to: 'alice@ex.com', subject: 'Hello' });
    expect(job.name).toBe('SendEmailJob');
    expect(job.queue).toBe('emails');
    expect(job.maxTries).toBe(5);
    expect(job.payload).toEqual({ to: 'alice@ex.com', subject: 'Hello' });
  });
});

// ── SyncQueueAdapter ──────────────────────────────────────

describe('CARP-026: SyncQueueAdapter', () => {
  let adapter: SyncQueueAdapter;

  beforeEach(() => { adapter = new SyncQueueAdapter(); });

  it('executes job handler immediately', async () => {
    let handled = false;
    adapter.registerHandler('SendEmailJob', async (payload) => {
      handled = true;
      expect(payload).toEqual({ to: 'a@b.com', subject: 'Hi' });
    });

    const job = SendEmailJob.toQueuedJob({ to: 'a@b.com', subject: 'Hi' });
    await adapter.push(job);
    expect(handled).toBe(true);
  });

  it('returns an ID', async () => {
    const id = await adapter.push(SendEmailJob.toQueuedJob({ to: 'x', subject: 'y' }));
    expect(id).toContain('sync-');
  });

  it('size() always returns 0 (no queue)', async () => {
    expect(await adapter.size()).toBe(0);
  });

  it('pop() always returns null', async () => {
    expect(await adapter.pop()).toBeNull();
  });
});

// ── MemoryQueueAdapter ────────────────────────────────────

describe('CARP-026: MemoryQueueAdapter', () => {
  let adapter: MemoryQueueAdapter;

  beforeEach(() => { adapter = new MemoryQueueAdapter(); });

  it('push() stores job in queue', async () => {
    const job = SendEmailJob.toQueuedJob({ to: 'a@b.com', subject: 'Hi' });
    const id = await adapter.push(job);
    expect(id).toBeTruthy();
    expect(await adapter.size('emails')).toBe(1);
  });

  it('pop() returns and removes first job (FIFO)', async () => {
    await adapter.push(SendEmailJob.toQueuedJob({ to: 'a', subject: '1' }));
    await adapter.push(SendEmailJob.toQueuedJob({ to: 'b', subject: '2' }));

    const first = await adapter.pop('emails');
    expect(first!.payload).toEqual({ to: 'a', subject: '1' });
    expect(await adapter.size('emails')).toBe(1);

    const second = await adapter.pop('emails');
    expect(second!.payload).toEqual({ to: 'b', subject: '2' });
    expect(await adapter.size('emails')).toBe(0);
  });

  it('pop() returns null when empty', async () => {
    expect(await adapter.pop('emails')).toBeNull();
  });

  it('assertPushed() checks job existence', async () => {
    await adapter.push(SendEmailJob.toQueuedJob({ to: 'x', subject: 'y' }));
    adapter.assertPushed('SendEmailJob', 'emails');
    expect(() => adapter.assertPushed('NonexistentJob', 'emails')).toThrow();
  });

  it('assertNothingPushed()', () => {
    adapter.assertNothingPushed();
    // After pushing, it should throw
  });

  it('assertCount()', async () => {
    await adapter.push(SendEmailJob.toQueuedJob({ to: 'a', subject: '1' }));
    await adapter.push(SendEmailJob.toQueuedJob({ to: 'b', subject: '2' }));
    adapter.assertCount(2, 'emails');
  });

  it('getJobs() returns all jobs', async () => {
    await adapter.push(SendEmailJob.toQueuedJob({ to: 'a', subject: '1' }));
    const jobs = adapter.getJobs('emails');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe('SendEmailJob');
  });

  it('reset() clears all queues', async () => {
    await adapter.push(SendEmailJob.toQueuedJob({ to: 'a', subject: '1' }));
    adapter.reset();
    adapter.assertNothingPushed();
  });

  it('later() stores job (ignores delay in memory)', async () => {
    await adapter.later(60, SendEmailJob.toQueuedJob({ to: 'a', subject: '1' }));
    expect(await adapter.size('emails')).toBe(1);
  });
});

// ── QueueManager ──────────────────────────────────────────

describe('CARP-026: QueueManager', () => {
  let manager: QueueManager;

  beforeEach(() => {
    manager = new QueueManager('memory', { memory: { driver: 'memory' } });
  });

  it('proxies to default connection', async () => {
    await manager.push(SendEmailJob.toQueuedJob({ to: 'a', subject: '1' }));
    expect(await manager.size('emails')).toBe(1);
  });

  it('resolves named connections', () => {
    const conn = manager.connection('memory');
    expect(conn).toBeDefined();
    expect(manager.connection('memory')).toBe(conn); // cached
  });

  it('throws on unknown driver', () => {
    expect(() => manager.connection('redis')).toThrow('not configured');
  });
});

// ── Queue Facade ──────────────────────────────────────────

describe('CARP-026: Queue Facade + dispatch()', () => {
  beforeEach(() => {
    setQueueManager(new QueueManager('memory'));
  });

  it('Queue.push()', async () => {
    await Queue.push(SendEmailJob.toQueuedJob({ to: 'a', subject: 'b' }));
    expect(await Queue.size('emails')).toBe(1);
  });

  it('dispatch() helper', async () => {
    await dispatch(SendEmailJob, { to: 'a', subject: 'b' });
    expect(await Queue.size('emails')).toBe(1);
  });
});
