import { describe, expect, it } from 'vitest';

import { ArrayChannel } from '../../src/log/channels.js';
import { Logger } from '../../src/log/Logger.js';
import { AuditLogger, InMemoryAuditChannel, LogAuditChannel } from '../../src/log/audit.js';

describe('log/audit', () => {
  it('records enriched audit entries through AuditLogger', async () => {
    const memory = new InMemoryAuditChannel();
    const audit = new AuditLogger([memory]);
    audit.setUserResolver(() => 'u1');
    audit.setMetadataResolver(() => ({ requestId: 'r1', tenant: 'acme' }));

    await audit.created('user', '42', { email: 'a@b.com' });

    const [entry] = memory.all();
    expect(entry?.userId).toBe('u1');
    expect(entry?.action).toBe('created');
    expect(entry?.resourceType).toBe('user');
    expect(entry?.resourceId).toBe('42');
    expect(entry?.newValues).toEqual({ email: 'a@b.com' });
    expect(entry?.metadata).toEqual({ requestId: 'r1', tenant: 'acme' });
  });

  it('supports convenience methods and query/assert helpers', async () => {
    const memory = new InMemoryAuditChannel();
    const audit = new AuditLogger([memory]);

    await audit.login('u2', { ip: '127.0.0.1' });
    await audit.updated('post', 'p1', { title: 'old' }, { title: 'new' });
    await audit.failedLogin({ email: 'x@y.com' });

    expect(memory.count()).toBe(3);
    expect(memory.forUser('u2')).toHaveLength(1);
    expect(memory.forAction('updated')).toHaveLength(1);
    expect(memory.forResource('post', 'p1')).toHaveLength(1);
    expect(memory.trail('post', 'p1')).toHaveLength(1);

    expect(() => memory.assertRecorded('login', 'session')).not.toThrow();
    expect(() => memory.assertUserActed('u2', 'login')).not.toThrow();
    expect(() => memory.assertChanges('post', 'p1', 'title')).not.toThrow();
    expect(() => memory.assertNotRecorded('deleted')).not.toThrow();

    memory.reset();
    expect(memory.count()).toBe(0);
  });

  it('LogAuditChannel forwards structured audit messages to Logger', () => {
    const array = new ArrayChannel('audit-channel');
    const logger = new Logger(array, { app: 'test' });
    const logAudit = new LogAuditChannel(logger);

    logAudit.record({
      userId: 'u3',
      action: 'deleted',
      resourceType: 'file',
      resourceId: 'f1',
      timestamp: new Date(),
      metadata: { tenant: 'north' },
    });

    const [entry] = array.all();
    expect(entry?.message).toContain('AUDIT: deleted on file#f1');
    expect(entry?.context).toMatchObject({ userId: 'u3', action: 'deleted', tenant: 'north' });
  });
});
