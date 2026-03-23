import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditManager } from '../src/index.js';

describe('@carpentry/audit: AuditManager', () => {
  it('stores and queries entries with database driver', async () => {
    const audit = new AuditManager({ driver: 'database', table: `audit_${Date.now()}_${Math.random()}` });

    await audit.log({
      actor: { type: 'user', id: 'u1' },
      action: 'order.created',
      target: { type: 'order', id: 'o1' },
      metadata: { total: 120 },
    });

    await audit.log({
      actor: { type: 'user', id: 'u2' },
      action: 'order.cancelled',
      target: { type: 'order', id: 'o2' },
    });

    const byUser = await audit.query({ actorId: 'u1' });
    expect(byUser.total).toBe(1);
    expect(byUser.entries[0]?.action).toBe('order.created');

    const paged = await audit.query({ page: 2, perPage: 1 });
    expect(paged.total).toBe(2);
    expect(paged.entries).toHaveLength(1);
  });

  it('writes and reads newline-delimited JSON for file driver', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'carpentry-audit-'));
    const filePath = join(dir, 'audit.log');

    try {
      const audit = new AuditManager({ driver: 'file', path: filePath });

      await audit.log({
        actor: { type: 'service', id: 'billing' },
        action: 'invoice.sent',
        target: { type: 'invoice', id: 'inv-1' },
      });

      await audit.log({
        actor: { type: 'service', id: 'billing' },
        action: 'invoice.paid',
        target: { type: 'invoice', id: 'inv-1' },
      });

      const all = await audit.query({});
      expect(all.total).toBe(2);
      expect(all.entries[1]?.action).toBe('invoice.paid');

      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]) as { chainHash: string; previousChainHash: string | null };
      const second = JSON.parse(lines[1]) as { chainHash: string; previousChainHash: string | null };
      expect(first.chainHash).toBeTypeOf('string');
      expect(first.previousChainHash).toBeNull();
      expect(second.previousChainHash).toBe(first.chainHash);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns no records with null driver', async () => {
    const audit = new AuditManager({ driver: 'null' });
    await audit.log({ actor: { type: 'user', id: 'u1' }, action: 'noop' });
    const result = await audit.query({});
    expect(result.total).toBe(0);
    expect(result.entries).toHaveLength(0);
  });
});
