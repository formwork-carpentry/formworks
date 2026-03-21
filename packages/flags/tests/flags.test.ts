import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFlagProvider, Experiment, setFlagProvider, feature } from '../src/index.js';

describe('@formwork/flags: InMemoryFlagProvider', () => {
  let flags: InMemoryFlagProvider;

  beforeEach(() => { flags = new InMemoryFlagProvider(); });

  it('undefined flag returns false', async () => {
    expect(await flags.isEnabled('nope')).toBe(false);
  });

  it('disabled flag returns false', async () => {
    flags.define('feature-x', { enabled: false });
    expect(await flags.isEnabled('feature-x')).toBe(false);
  });

  it('enabled flag returns true', async () => {
    flags.define('feature-x', { enabled: true });
    expect(await flags.isEnabled('feature-x')).toBe(true);
  });

  it('user targeting — allowed user', async () => {
    flags.define('beta', { enabled: true, allowedUsers: [1, 2, 3] });
    expect(await flags.isEnabled('beta', { userId: 2 })).toBe(true);
    expect(await flags.isEnabled('beta', { userId: 99 })).toBe(true); // no percentage restriction
  });

  it('group targeting', async () => {
    flags.define('admin-tools', { enabled: true, allowedGroups: ['admin', 'staff'] });
    expect(await flags.isEnabled('admin-tools', { userId: 1, groups: ['admin'] })).toBe(true);
    expect(await flags.isEnabled('admin-tools', { userId: 1, groups: ['guest'] })).toBe(true); // no percentage restriction
  });

  it('percentage rollout is deterministic', async () => {
    flags.define('gradual', { enabled: true, percentage: 50 });
    const result1 = await flags.isEnabled('gradual', { userId: 'user-a' });
    const result2 = await flags.isEnabled('gradual', { userId: 'user-a' });
    expect(result1).toBe(result2); // same user, same result
  });

  it('percentage 0 disables for all users', async () => {
    flags.define('nobody', { enabled: true, percentage: 0 });
    let anyEnabled = false;
    for (let i = 0; i < 50; i++) {
      if (await flags.isEnabled('nobody', { userId: `user-${i}` })) anyEnabled = true;
    }
    expect(anyEnabled).toBe(false);
  });

  it('percentage requires userId', async () => {
    flags.define('gradual', { enabled: true, percentage: 50 });
    expect(await flags.isEnabled('gradual')).toBe(false); // no userId
  });

  it('custom evaluator', async () => {
    flags.define('custom', { enabled: true, evaluator: (ctx) => ctx.userId === 42 });
    expect(await flags.isEnabled('custom', { userId: 42 })).toBe(true);
    expect(await flags.isEnabled('custom', { userId: 1 })).toBe(false);
  });

  it('override() bypasses all rules', async () => {
    flags.define('feature', { enabled: false });
    flags.override('feature', true);
    expect(await flags.isEnabled('feature')).toBe(true);

    flags.override('feature', false);
    expect(await flags.isEnabled('feature')).toBe(false);
  });

  it('clearOverrides() removes overrides', async () => {
    flags.define('feature', { enabled: true });
    flags.override('feature', false);
    expect(await flags.isEnabled('feature')).toBe(false);

    flags.clearOverrides();
    expect(await flags.isEnabled('feature')).toBe(true);
  });

  it('getFlags() lists defined flags', () => {
    flags.define('a', { enabled: true });
    flags.define('b', { enabled: false });
    expect(flags.getFlags()).toEqual(['a', 'b']);
  });

  it('reset() clears everything', () => {
    flags.define('a', { enabled: true });
    flags.override('a', false);
    flags.reset();
    expect(flags.getFlags()).toEqual([]);
  });
});

describe('@formwork/flags: Experiment', () => {
  it('assigns variant deterministically', () => {
    const exp = new Experiment('button-color', [
      { name: 'control', value: 'blue', weight: 50 },
      { name: 'variant', value: 'green', weight: 50 },
    ]);

    const result1 = exp.assign('user-123');
    const result2 = exp.assign('user-123');
    expect(result1).toEqual(result2); // deterministic
    expect(['control', 'variant']).toContain(result1.variant);
  });

  it('distributes users across variants', () => {
    const exp = new Experiment('pricing', [
      { name: 'a', value: 9.99, weight: 50 },
      { name: 'b', value: 14.99, weight: 50 },
    ]);

    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      const { variant } = exp.assign(`user-${i}`);
      counts[variant as 'a' | 'b']++;
    }

    // Each variant should get roughly 50% (within 15% tolerance)
    expect(counts.a).toBeGreaterThan(350);
    expect(counts.b).toBeGreaterThan(350);
  });

  it('throws if weights do not sum to 100', () => {
    expect(() => new Experiment('bad', [
      { name: 'a', value: 'x', weight: 30 },
      { name: 'b', value: 'y', weight: 30 },
    ])).toThrow('sum to 100');
  });

  it('getVariants() returns all variants', () => {
    const exp = new Experiment('test', [
      { name: 'a', value: 1, weight: 50 },
      { name: 'b', value: 2, weight: 50 },
    ]);
    expect(exp.getVariants()).toHaveLength(2);
  });
});

describe('@formwork/flags: feature() helper', () => {
  it('returns false when no provider set', async () => {
    expect(await feature('anything')).toBe(false);
  });

  it('delegates to provider when set', async () => {
    const provider = new InMemoryFlagProvider();
    provider.define('on', { enabled: true });
    setFlagProvider(provider);

    expect(await feature('on')).toBe(true);
    expect(await feature('off')).toBe(false);
  });
});
