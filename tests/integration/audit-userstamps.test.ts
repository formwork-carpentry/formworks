import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../../src/log/index.js';
import { BaseModel } from '../../src/orm/model/BaseModel.js';
import { createIntegrationHarness, User } from './support.js';

describe('integration/audit-userstamps', () => {
  let harness: ReturnType<typeof createIntegrationHarness>;

  beforeEach(() => {
    harness = createIntegrationHarness();
  });

  it('tracks audit lifecycle events', async () => {
    const audit = new AuditLogger([harness.auditChannel]);
    audit.setUserResolver(() => 1);

    await audit.created('User', 1, { name: 'Alice', email: 'alice@example.com' });
    await audit.updated('User', 1, { name: 'Alice' }, { name: 'Alice Updated' });
    await audit.viewed('User', 1);
    await audit.login(1, { ip: '192.168.1.1' });

    const trail = harness.auditChannel.trail('User', 1);
    expect(trail.map((e) => e.action)).toEqual(['created', 'updated', 'viewed']);

    harness.auditChannel.assertChanges('User', 1, 'name');
    harness.auditChannel.assertUserActed(1, 'created');
    harness.auditChannel.assertRecorded('login', 'session');
  });

  it('auto-sets userstamps on model create and update', async () => {
    BaseModel.userResolver = () => 42;
    harness.db.queueResult([], 1, 1);

    const user = new User({ name: 'Test' });
    await user.save();

    expect(user.getAttribute('created_by')).toBe(42);
    expect(user.getAttribute('updated_by')).toBe(42);

    BaseModel.userResolver = () => 99;
    user.setAttribute('name', 'Updated');
    harness.db.queueResult([], 1);
    await user.save();

    expect(user.getAttribute('created_by')).toBe(42);
    expect(user.getAttribute('updated_by')).toBe(99);
  });
});
