/**
 * @module @formwork/bridge
 * @description BridgeManager test suite — verifies transport resolution, lifecycle,
 * and driver registration via the Domain Factory Manager pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BridgeManager } from '../src/manager/BridgeManager.js';

describe('BridgeManager', () => {
  let manager: BridgeManager;

  beforeEach(() => {
    manager = new BridgeManager('memory', {
      memory: { driver: 'memory' },
    });
  });

  it('resolves the default transport', () => {
    const transport = manager.transport();
    expect(transport).toBeDefined();
  });

  it('registers built-in memory driver', () => {
    expect(manager.hasDriver('memory')).toBe(true);
  });

  it('caches resolved transports (singleton per name)', () => {
    const first = manager.transport('memory');
    const second = manager.transport('memory');
    expect(first).toBe(second);
  });

  it('throws when transport is not configured', () => {
    expect(() => manager.transport('unknown')).toThrow(
      /Bridge transport "unknown" is not configured/,
    );
  });

  it('throws when driver is not registered', () => {
    const mgr = new BridgeManager('x', {
      x: { driver: 'nats' },
    });
    // nats not registered in this test instance
    expect(() => mgr.transport()).toThrow(
      /Bridge driver "nats" is not registered/,
    );
  });

  it('registerDriver returns this for chaining', () => {
    const result = manager.registerDriver('test', () => ({
      send: async () => ({ id: '1', payload: null, durationMs: 0 }),
      connect: async () => {},
      disconnect: async () => {},
      isConnected: () => false,
    }));
    expect(result).toBe(manager);
  });

  it('disconnect clears cached transport', async () => {
    const before = manager.transport('memory');
    await manager.disconnect('memory');
    const after = manager.transport('memory');
    expect(before).not.toBe(after);
  });

  it('disconnectAll clears all cached transports', async () => {
    const t = manager.transport('memory');
    await manager.disconnectAll();
    const t2 = manager.transport('memory');
    expect(t).not.toBe(t2);
  });
});
