/**
 * @module @formwork/core
 * @description BaseManager test suite — verifies the shared Domain Factory Manager pattern.
 *
 * Covers:
 * - Driver registration and chaining
 * - Lazy resolution and caching
 * - Fail-fast errors for unregistered/unconfigured names
 * - Default name management
 * - Purge and purgeAll lifecycle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CarpenterFactoryBase, type CarpenterFactoryAdapter } from '../src/adapters/index.js';

// ── Test double ───────────────────────────────────────────

interface TestAdapter {
  id: string;
}

interface TestConfig {
  driver: string;
  value?: string;
  [key: string]: unknown;
}

class TestManager extends CarpenterFactoryBase<TestAdapter, TestConfig> {
  protected readonly resolverLabel = 'connection';
  protected readonly domainLabel = 'Test';

  /** Public accessor for the protected resolve() */
  connection(name?: string): TestAdapter {
    return this.resolve(name);
  }
}

// ── Tests ─────────────────────────────────────────────────

describe('BaseManager', () => {
  let manager: TestManager;

  const memoryFactory: CarpenterFactoryAdapter<TestConfig, TestAdapter> = (config) => ({
    id: `memory:${config.value ?? 'default'}`,
  });

  const fileFactory: CarpenterFactoryAdapter<TestConfig, TestAdapter> = (config) => ({
    id: `file:${config.value ?? 'default'}`,
  });

  beforeEach(() => {
    manager = new TestManager('primary', {
      primary: { driver: 'memory', value: 'p' },
      secondary: { driver: 'file', value: 's' },
    });
    manager.registerDriver('memory', memoryFactory);
    manager.registerDriver('file', fileFactory);
  });

  // ── Registration ──────────────────────────────────────

  it('registerDriver returns this for chaining', () => {
    const result = manager.registerDriver('sqlite', memoryFactory);
    expect(result).toBe(manager);
  });

  it('hasDriver reports registered drivers', () => {
    expect(manager.hasDriver('memory')).toBe(true);
    expect(manager.hasDriver('redis')).toBe(false);
  });

  it('getDriverNames returns all registered drivers', () => {
    expect(manager.getDriverNames()).toEqual(
      expect.arrayContaining(['memory', 'file']),
    );
  });

  // ── Resolution ────────────────────────────────────────

  it('resolves default connection', () => {
    const adapter = manager.connection();
    expect(adapter.id).toBe('memory:p');
  });

  it('resolves named connection', () => {
    const adapter = manager.connection('secondary');
    expect(adapter.id).toBe('file:s');
  });

  it('caches resolved instances (singleton per name)', () => {
    const first = manager.connection('primary');
    const second = manager.connection('primary');
    expect(first).toBe(second);
  });

  it('creates separate instances for different names', () => {
    const a = manager.connection('primary');
    const b = manager.connection('secondary');
    expect(a).not.toBe(b);
  });

  // ── Error handling ────────────────────────────────────

  it('throws when resolving an unconfigured name', () => {
    expect(() => manager.connection('unknown')).toThrow(
      /Test connection "unknown" is not configured/,
    );
  });

  it('throws when driver is not registered', () => {
    const mgr = new TestManager('x', {
      x: { driver: 'redis' },
    });
    expect(() => mgr.connection()).toThrow(
      /Test driver "redis" is not registered/,
    );
  });

  it('error message includes available configs', () => {
    try {
      manager.connection('nope');
    } catch (e) {
      expect((e as Error).message).toContain('primary');
      expect((e as Error).message).toContain('secondary');
    }
  });

  it('error message includes available drivers', () => {
    const mgr = new TestManager('x', { x: { driver: 'bad' } });
    try {
      mgr.connection();
    } catch (e) {
      expect((e as Error).message).toContain('(none)');
    }
  });

  // ── Config helpers ────────────────────────────────────

  it('getConfiguredNames returns all config keys', () => {
    expect(manager.getConfiguredNames()).toEqual(['primary', 'secondary']);
  });

  it('hasConfig checks for named config', () => {
    expect(manager.hasConfig('primary')).toBe(true);
    expect(manager.hasConfig('missing')).toBe(false);
  });

  // ── Default name ──────────────────────────────────────

  it('getDefaultName returns constructor default', () => {
    expect(manager.getDefaultName()).toBe('primary');
  });

  it('setDefaultName changes the default', () => {
    manager.setDefaultName('secondary');
    expect(manager.getDefaultName()).toBe('secondary');
    expect(manager.connection().id).toBe('file:s');
  });

  // ── Lifecycle ─────────────────────────────────────────

  it('purge removes cached instance', async () => {
    const before = manager.connection('primary');
    await manager.purge('primary');
    const after = manager.connection('primary');
    expect(before).not.toBe(after);
    expect(before.id).toBe(after.id); // same config → same value
  });

  it('purge defaults to default name', async () => {
    const before = manager.connection();
    await manager.purge();
    const after = manager.connection();
    expect(before).not.toBe(after);
  });

  it('purgeAll removes all cached instances', async () => {
    const a = manager.connection('primary');
    const b = manager.connection('secondary');
    await manager.purgeAll();
    expect(manager.connection('primary')).not.toBe(a);
    expect(manager.connection('secondary')).not.toBe(b);
  });
});
