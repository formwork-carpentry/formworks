import { describe, expect, it, vi } from 'vitest';

import { LogManager } from '../../src/log/LogManager.js';
import { ArrayChannel } from '../../src/log/channels.js';
import { AuditLogger, InMemoryAuditChannel } from '../../src/log/audit.js';

describe('log/facades', () => {
  it('throws when global managers are not initialized', async () => {
    vi.resetModules();
    const facades = await import('../../src/log/facades.js');

    expect(() => facades.Log.info('x')).toThrow('LogManager not initialized.');
    expect(() => facades.Audit.viewed('post', '1')).toThrow('AuditLogger not initialized.');
  });

  it('delegates through configured Log and Audit facades', async () => {
    vi.resetModules();
    const facades = await import('../../src/log/facades.js');

    const manager = new LogManager('test');
    const channel = new ArrayChannel('test');
    manager.addChannel(channel);
    facades.setLogManager(manager);

    const auditChannel = new InMemoryAuditChannel();
    const audit = new AuditLogger([auditChannel]);
    facades.setAuditLogger(audit);

    facades.Log.error('boom', { id: 7 });
    await facades.Audit.deleted('invoice', 'inv_1');

    expect(channel.all()).toHaveLength(1);
    expect(channel.all()[0]?.message).toBe('boom');
    expect(channel.all()[0]?.level).toBe('error');

    expect(auditChannel.all()).toHaveLength(1);
    expect(auditChannel.all()[0]?.action).toBe('deleted');
    expect(auditChannel.all()[0]?.resourceType).toBe('invoice');
  });
});
