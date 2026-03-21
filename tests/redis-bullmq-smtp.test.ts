/**
 * @module tests
 * @description Tests for production adapters: Redis cache, BullMQ queue, SMTP mail.
 * All use mock transports — no running Redis or SMTP server needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RedisCacheStore, MockRedisClient } from '../packages/cache/src/adapters/RedisCacheStore.js';
import { BullMqAdapter, MockBullMqQueue } from '../packages/queue/src/adapters/BullMqAdapter.js';
import { SmtpMailAdapter, MockSmtpTransport } from '../packages/mail/src/adapters/SmtpMailAdapter.js';

// ═══════════════════════════════════════════════════════════
// REDIS CACHE
// ═══════════════════════════════════════════════════════════

describe('RedisCacheStore', () => {
  let redis: MockRedisClient;
  let cache: RedisCacheStore;

  beforeEach(() => {
    redis = new MockRedisClient();
    cache = new RedisCacheStore(redis, { prefix: 'test:' });
  });

  it('stores and retrieves values (JSON serialized)', async () => {
    await cache.put('user', { name: 'Alice', age: 30 });
    expect(await cache.get('user')).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns null for missing keys', async () => {
    expect(await cache.get('nonexistent')).toBeNull();
  });

  it('stores with TTL', async () => {
    await cache.put('temp', 'value', 60);
    expect(await cache.get('temp')).toBe('value');
    // The MockRedisClient tracks expiration
  });

  it('forgets a key', async () => {
    await cache.put('key', 'val');
    expect(await cache.forget('key')).toBe(true);
    expect(await cache.get('key')).toBeNull();
  });

  it('has() checks existence', async () => {
    await cache.put('exists', true);
    expect(await cache.has('exists')).toBe(true);
    expect(await cache.has('missing')).toBe(false);
  });

  it('increment and decrement atomically', async () => {
    expect(await cache.increment('counter')).toBe(1);
    expect(await cache.increment('counter', 5)).toBe(6);
    expect(await cache.decrement('counter', 2)).toBe(4);
  });

  it('many() retrieves multiple keys', async () => {
    await cache.put('a', 1);
    await cache.put('b', 2);
    const result = await cache.many(['a', 'b', 'c']);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.get('c')).toBeNull();
  });

  it('putMany() stores multiple entries', async () => {
    await cache.putMany(new Map([['x', 10], ['y', 20]]));
    expect(await cache.get('x')).toBe(10);
    expect(await cache.get('y')).toBe(20);
  });

  it('remember() caches callback result', async () => {
    let calls = 0;
    const v1 = await cache.remember('computed', 60, () => { calls++; return 'result'; });
    const v2 = await cache.remember('computed', 60, () => { calls++; return 'other'; });
    expect(v1).toBe('result');
    expect(v2).toBe('result');
    expect(calls).toBe(1);
  });

  it('flush() clears only prefixed keys', async () => {
    await cache.put('a', 1);
    await cache.put('b', 2);
    await cache.flush();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('uses configured prefix', () => {
    expect(cache.getPrefix()).toBe('test:');
  });
});

// ═══════════════════════════════════════════════════════════
// BULLMQ QUEUE
// ═══════════════════════════════════════════════════════════

describe('BullMqAdapter', () => {
  let mockQueue: MockBullMqQueue;
  let adapter: BullMqAdapter;

  beforeEach(() => {
    mockQueue = new MockBullMqQueue();
    adapter = new BullMqAdapter(mockQueue, { queueName: 'emails' });
  });

  it('pushes a job and returns an ID', async () => {
    const id = await adapter.push({ name: 'SendEmail', payload: { to: 'user@test.com' } });
    expect(id).toContain('mock_');
    expect(mockQueue.getJobs()).toHaveLength(1);
    expect(mockQueue.getJobs()[0].name).toBe('SendEmail');
  });

  it('pushes raw payload', async () => {
    const id = await adapter.pushRaw(JSON.stringify({ action: 'cleanup' }));
    expect(id).toBeTruthy();
    expect(mockQueue.getJobs()).toHaveLength(1);
  });

  it('pushes delayed job', async () => {
    const id = await adapter.later(30, { name: 'Reminder', payload: {} });
    expect(id).toBeTruthy();
    const job = mockQueue.getJobs()[0];
    expect(job.opts['delay']).toBe(30000); // 30 seconds in ms
  });

  it('reports queue size', async () => {
    await adapter.push({ name: 'A', payload: {} });
    await adapter.push({ name: 'B', payload: {} });
    expect(await adapter.size()).toBe(2);
  });

  it('pop returns null (BullMQ uses Worker model)', async () => {
    await adapter.push({ name: 'A', payload: {} });
    expect(await adapter.pop()).toBeNull();
  });

  it('purges all jobs', async () => {
    await adapter.push({ name: 'A', payload: {} });
    await adapter.push({ name: 'B', payload: {} });
    await adapter.purge();
    expect(mockQueue.getJobs()).toHaveLength(0);
  });

  it('respects maxTries on jobs', async () => {
    await adapter.push({ name: 'Retry', payload: {}, maxTries: 5 });
    expect(mockQueue.getJobs()[0].opts['attempts']).toBe(5);
  });

  it('returns queue name', () => {
    expect(adapter.getQueueName()).toBe('emails');
  });
});

// ═══════════════════════════════════════════════════════════
// SMTP MAIL
// ═══════════════════════════════════════════════════════════

describe('SmtpMailAdapter', () => {
  let transport: MockSmtpTransport;
  let mailer: SmtpMailAdapter;

  beforeEach(() => {
    transport = new MockSmtpTransport();
    mailer = new SmtpMailAdapter(transport, { from: 'noreply@myapp.com', fromName: 'My App' });
  });

  it('sends email via SMTP transport', async () => {
    await mailer.send({ to: 'user@test.com', subject: 'Hello', html: '<p>Hi!</p>' });

    expect(transport.getSentMail()).toHaveLength(1);
    const sent = transport.getSentMail()[0];
    expect(sent.to).toBe('user@test.com');
    expect(sent.subject).toBe('Hello');
    expect(sent.html).toBe('<p>Hi!</p>');
    expect(sent.from).toContain('My App');
    expect(sent.from).toContain('noreply@myapp.com');
  });

  it('sends text-only email', async () => {
    await mailer.send({ to: 'user@test.com', subject: 'Plain', text: 'Hello plain text' });
    expect(transport.getSentMail()[0].text).toBe('Hello plain text');
  });

  it('tracks sent messages', async () => {
    await mailer.send({ to: 'a@test.com', subject: 'A' });
    await mailer.send({ to: 'b@test.com', subject: 'B' });
    expect(mailer.getSent()).toHaveLength(2);
  });

  it('throws on delivery failure', async () => {
    transport.setFail(true);
    await expect(mailer.send({ to: 'fail@test.com', subject: 'Fail' }))
      .rejects.toThrow('SMTP delivery failed');
  });

  it('uses custom from address per message', async () => {
    await mailer.send({ to: 'user@test.com', subject: 'X', from: 'custom@other.com' });
    expect(transport.getSentMail()[0].from).toBe('custom@other.com');
  });
});
