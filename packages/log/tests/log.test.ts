import { describe, it, expect, beforeEach } from 'vitest';
import {
  Logger, LogManager, ArrayChannel, JsonChannel, NullChannel, StackChannel, ConsoleChannel,
  AuditLogger, InMemoryAuditChannel, LogAuditChannel,
  setLogManager, setAuditLogger, Log, Audit,
} from '../src/index.js';

// ════════════════════════════════════════════════════════════
// APPLICATION LOGGING
// ════════════════════════════════════════════════════════════

describe('@carpentry/log: Logger', () => {
  let channel: ArrayChannel;
  let logger: Logger;

  beforeEach(() => {
    channel = new ArrayChannel();
    logger = new Logger(channel);
  });

  describe('log levels', () => {
    it('logs at every RFC 5424 level', () => {
      logger.emergency('system down');
      logger.alert('disk full');
      logger.critical('payment failed');
      logger.error('query failed');
      logger.warning('slow query');
      logger.notice('user registered');
      logger.info('request handled');
      logger.debug('variable dump');

      channel.assertCount(8);
      channel.assertLogged('emergency', 'system down');
      channel.assertLogged('debug', 'variable dump');
    });

    it('log() with explicit level', () => {
      logger.log('warning', 'disk at 90%');
      channel.assertLogged('warning', 'disk at 90%');
    });
  });

  describe('structured context', () => {
    it('includes context in log entry', () => {
      logger.error('Query failed', { table: 'users', duration: 5000 });

      const entry = channel.all()[0];
      expect(entry.context).toEqual({ table: 'users', duration: 5000 });
    });

    it('withContext() creates child logger with default context', () => {
      const requestLogger = logger.withContext({ requestId: 'req-123', userId: 42 });
      requestLogger.info('Handling request');
      requestLogger.info('Done');

      const entries = channel.all();
      expect(entries[0].context).toEqual({ requestId: 'req-123', userId: 42 });
      expect(entries[1].context).toEqual({ requestId: 'req-123', userId: 42 });
    });

    it('withContext() merges with per-call context', () => {
      const requestLogger = logger.withContext({ requestId: 'req-123' });
      requestLogger.info('Found user', { userId: 42 });

      const entry = channel.all()[0];
      expect(entry.context).toEqual({ requestId: 'req-123', userId: 42 });
    });
  });

  describe('timestamps', () => {
    it('includes timestamp on every entry', () => {
      logger.info('test');
      expect(channel.all()[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('channel name', () => {
    it('tags entries with channel name', () => {
      logger.info('test');
      expect(channel.all()[0].channel).toBe('array');
    });
  });
});

// ── ArrayChannel assertions ───────────────────────────────

describe('@carpentry/log: ArrayChannel', () => {
  let channel: ArrayChannel;

  beforeEach(() => { channel = new ArrayChannel(); });

  it('forLevel() filters by level', () => {
    const logger = new Logger(channel);
    logger.info('a');
    logger.error('b');
    logger.info('c');

    expect(channel.forLevel('info')).toHaveLength(2);
    expect(channel.forLevel('error')).toHaveLength(1);
  });

  it('assertLogged() with message fragment', () => {
    new Logger(channel).error('Connection refused: host=db.local');
    channel.assertLogged('error', 'Connection refused');
  });

  it('assertNotLogged()', () => {
    new Logger(channel).info('ok');
    channel.assertNotLogged('error');
    expect(() => channel.assertNotLogged('info')).toThrow();
  });

  it('assertLoggedWithContext()', () => {
    new Logger(channel).error('fail', { code: 'ECONNREFUSED', host: 'db.local' });
    channel.assertLoggedWithContext('error', 'code', 'ECONNREFUSED');
    channel.assertLoggedWithContext('error', 'host');
  });

  it('assertNothingLogged()', () => {
    channel.assertNothingLogged();
    new Logger(channel).info('x');
    expect(() => channel.assertNothingLogged()).toThrow();
  });

  it('respects minLevel filter', () => {
    const errorOnly = new ArrayChannel('errors', 'error');
    const logger = new Logger(errorOnly);
    logger.debug('ignored');
    logger.info('ignored');
    logger.warning('ignored');
    logger.error('captured');
    logger.critical('captured');

    expect(errorOnly.count()).toBe(2);
  });
});

// ── Other channels ────────────────────────────────────────

describe('@carpentry/log: JsonChannel', () => {
  it('outputs structured JSON lines', () => {
    const channel = new JsonChannel();
    new Logger(channel).info('request handled', { method: 'GET', path: '/users' });

    const lines = channel.getOutput();
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('request handled');
    expect(parsed.method).toBe('GET');
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.severity).toBe(6); // info = 6
  });
});

describe('@carpentry/log: NullChannel', () => {
  it('discards everything', () => {
    const channel = new NullChannel();
    new Logger(channel).error('ignored');
    // No assertion needed — just verify it doesn't throw
  });
});

describe('@carpentry/log: StackChannel', () => {
  it('fan-out to multiple channels', () => {
    const a = new ArrayChannel('chan-a');
    const b = new ArrayChannel('chan-b');
    const stack = new StackChannel([a, b]);

    new Logger(stack).info('broadcast');

    expect(a.count()).toBe(1);
    expect(b.count()).toBe(1);
  });

  it('getChannels()', () => {
    const stack = new StackChannel([new ArrayChannel(), new NullChannel()]);
    expect(stack.getChannels()).toHaveLength(2);
  });
});

// ── LogManager ────────────────────────────────────────────

describe('@carpentry/log: LogManager', () => {
  let manager: LogManager;

  beforeEach(() => { manager = new LogManager('console'); });

  it('resolves channels by name', () => {
    const arr = new ArrayChannel('test');
    manager.addChannel(arr);
    const logger = manager.channel('test');
    logger.info('hello');
    expect(arr.count()).toBe(1);
  });

  it('throws for unknown channel', () => {
    expect(() => manager.channel('nonexistent')).toThrow('not registered');
  });

  it('fake() replaces channel with ArrayChannel', () => {
    const fake = manager.fake('console');
    manager.info('test message');
    fake.assertLogged('info', 'test message');
  });

  it('convenience methods proxy to default channel', () => {
    const fake = manager.fake('console');
    manager.error('boom');
    manager.warning('careful');
    manager.debug('trace');
    expect(fake.count()).toBe(3);
  });
});

// ── Log Facade ────────────────────────────────────────────

describe('@carpentry/log: Log Facade', () => {
  let fake: ArrayChannel;

  beforeEach(() => {
    const manager = new LogManager('console');
    fake = manager.fake('console');
    setLogManager(manager);
  });

  it('Log.info()', () => {
    Log.info('hello');
    fake.assertLogged('info', 'hello');
  });

  it('Log.error() with context', () => {
    Log.error('failed', { code: 500 });
    fake.assertLoggedWithContext('error', 'code', 500);
  });

  it('Log.channel() returns named logger', () => {
    const manager = new LogManager();
    const custom = new ArrayChannel('custom');
    manager.addChannel(custom);
    setLogManager(manager);

    Log.channel('custom').info('custom log');
    expect(custom.count()).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════
// AUDIT LOGGING
// ════════════════════════════════════════════════════════════

describe('@carpentry/log: AuditLogger', () => {
  let channel: InMemoryAuditChannel;
  let audit: AuditLogger;

  beforeEach(() => {
    channel = new InMemoryAuditChannel();
    audit = new AuditLogger([channel]);
  });

  describe('CRUD operations', () => {
    it('created()', async () => {
      await audit.created('User', 1, { name: 'Alice', email: 'a@b.com' });

      channel.assertRecorded('created', 'User');
      const entry = channel.all()[0];
      expect(entry.resourceId).toBe(1);
      expect(entry.newValues).toEqual({ name: 'Alice', email: 'a@b.com' });
    });

    it('updated() with old + new values', async () => {
      await audit.updated('User', 1, { name: 'Alice' }, { name: 'Bob' });

      channel.assertRecorded('updated', 'User');
      const entry = channel.all()[0];
      expect(entry.oldValues).toEqual({ name: 'Alice' });
      expect(entry.newValues).toEqual({ name: 'Bob' });
    });

    it('deleted()', async () => {
      await audit.deleted('User', 1);
      channel.assertRecorded('deleted', 'User');
    });

    it('viewed()', async () => {
      await audit.viewed('Report', 42);
      channel.assertRecorded('viewed', 'Report');
    });
  });

  describe('auth events', () => {
    it('login()', async () => {
      await audit.login(1, { ip: '192.168.1.1' });
      channel.assertRecorded('login', 'session');
      expect(channel.all()[0].userId).toBe(1);
    });

    it('logout()', async () => {
      await audit.logout(1);
      channel.assertRecorded('logout', 'session');
    });

    it('failedLogin()', async () => {
      await audit.failedLogin({ email: 'hacker@evil.com' }, { ip: '10.0.0.1' });
      channel.assertRecorded('failed_login', 'session');
      expect(channel.all()[0].userId).toBeNull();
    });
  });

  describe('user resolver', () => {
    it('auto-populates userId from resolver', async () => {
      audit.setUserResolver(() => 42);
      await audit.created('Post', 1);

      expect(channel.all()[0].userId).toBe(42);
    });

    it('explicit userId overrides resolver', async () => {
      audit.setUserResolver(() => 42);
      await audit.record({ userId: 99, action: 'updated', resourceType: 'Post' });

      expect(channel.all()[0].userId).toBe(99);
    });
  });

  describe('metadata resolver', () => {
    it('auto-includes default metadata', async () => {
      audit.setMetadataResolver(() => ({ requestId: 'req-abc', tenant: 'acme' }));
      await audit.created('User', 1);

      expect(channel.all()[0].metadata).toEqual({ requestId: 'req-abc', tenant: 'acme' });
    });
  });

  describe('multiple channels', () => {
    it('writes to all channels', async () => {
      const chan2 = new InMemoryAuditChannel();
      const multiAudit = new AuditLogger([channel, chan2]);
      await multiAudit.created('User', 1);

      expect(channel.count()).toBe(1);
      expect(chan2.count()).toBe(1);
    });
  });

  describe('custom actions', () => {
    it('supports arbitrary action strings', async () => {
      await audit.record({ action: 'approved', resourceType: 'Invoice', resourceId: 55 });
      channel.assertRecorded('approved', 'Invoice');
    });
  });
});

// ── InMemoryAuditChannel queries ──────────────────────────

describe('@carpentry/log: InMemoryAuditChannel queries', () => {
  let channel: InMemoryAuditChannel;
  let audit: AuditLogger;

  beforeEach(async () => {
    channel = new InMemoryAuditChannel();
    audit = new AuditLogger([channel]);

    audit.setUserResolver(() => 1);
    await audit.created('User', 10, { name: 'Alice' });
    await audit.updated('User', 10, { name: 'Alice' }, { name: 'Bob' });
    await audit.viewed('User', 10);
    await audit.deleted('Post', 20);
  });

  it('forUser() filters by user', () => {
    expect(channel.forUser(1)).toHaveLength(4);
    expect(channel.forUser(999)).toHaveLength(0);
  });

  it('forResource() filters by type and id', () => {
    expect(channel.forResource('User')).toHaveLength(3);
    expect(channel.forResource('User', 10)).toHaveLength(3);
    expect(channel.forResource('Post')).toHaveLength(1);
  });

  it('forAction() filters by action', () => {
    expect(channel.forAction('created')).toHaveLength(1);
    expect(channel.forAction('updated')).toHaveLength(1);
  });

  it('trail() returns chronological audit trail for a resource', () => {
    const trail = channel.trail('User', 10);
    expect(trail).toHaveLength(3);
    expect(trail.map((e) => e.action)).toEqual(['created', 'updated', 'viewed']);
  });

  it('assertChanges() checks for field-level changes', () => {
    channel.assertChanges('User', 10, 'name');
    expect(() => channel.assertChanges('User', 10, 'email')).toThrow();
  });

  it('assertUserActed()', () => {
    channel.assertUserActed(1, 'created');
    expect(() => channel.assertUserActed(999, 'created')).toThrow();
  });

  it('assertNotRecorded()', () => {
    channel.assertNotRecorded('restored');
    expect(() => channel.assertNotRecorded('created')).toThrow();
  });
});

// ── LogAuditChannel ───────────────────────────────────────

describe('@carpentry/log: LogAuditChannel', () => {
  it('writes audit entries to app logger', async () => {
    const logChannel = new ArrayChannel('app');
    const logger = new Logger(logChannel);
    const auditChannel = new LogAuditChannel(logger);

    const audit = new AuditLogger([auditChannel]);
    await audit.created('User', 1, { name: 'Alice' });

    logChannel.assertLogged('info', 'AUDIT: created on User#1');
    logChannel.assertLoggedWithContext('info', 'action', 'created');
  });
});

// ── Audit Facade ──────────────────────────────────────────

describe('@carpentry/log: Audit Facade', () => {
  let channel: InMemoryAuditChannel;

  beforeEach(() => {
    channel = new InMemoryAuditChannel();
    setAuditLogger(new AuditLogger([channel]));
  });

  it('Audit.created()', async () => {
    await Audit.created('Order', 1, { total: 99 });
    channel.assertRecorded('created', 'Order');
  });

  it('Audit.updated()', async () => {
    await Audit.updated('Order', 1, { status: 'pending' }, { status: 'shipped' });
    channel.assertRecorded('updated');
  });

  it('Audit.login()', async () => {
    await Audit.login(42);
    channel.assertRecorded('login');
  });

  it('Audit.failedLogin()', async () => {
    await Audit.failedLogin({ email: 'x@y.com' });
    channel.assertRecorded('failed_login');
  });
});
