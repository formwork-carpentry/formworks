import { describe, it, expect, vi } from 'vitest';

import { DatabaseManager } from '../src/adapters/databaseManager.js';
import type { IDatabaseAdapter } from '@formwork/core/contracts';

type TestAdapter = IDatabaseAdapter & {
  disconnect: () => Promise<void>;
};

function makeAdapter(): { adapter: TestAdapter; disconnect: ReturnType<typeof vi.fn> } {
  const disconnect = vi.fn(async () => {});

  const adapter = {
    disconnect,

    execute: vi.fn(async () => [] as Record<string, unknown>[]),
    run: vi.fn(async () => ({ affectedRows: 0 })),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  } as TestAdapter;

  return { adapter, disconnect };
}

describe('@formwork/db DatabaseManager', () => {
  it('returns cached connections per name', () => {
    const created: TestAdapter[] = [];
    const factory = vi.fn(() => {
      const { adapter } = makeAdapter();
      created.push(adapter);
      return adapter;
    });

    const mgr = new DatabaseManager(
      'sqlite',
      {
        sqlite: { driver: 'memory' },
        pg: { driver: 'postgres' },
      },
    );
    mgr.registerDriver('memory', factory);
    mgr.registerDriver('postgres', factory);

    const c1 = mgr.connection();
    const c2 = mgr.connection();
    expect(c1).toBe(c2);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(mgr.getDefaultConnection()).toBe('sqlite');
  });

  it('uses configured default connection when no name is passed', () => {
    const factory = vi.fn(() => makeAdapter().adapter);
    const mgr = new DatabaseManager('memory', { memory: { driver: 'sqlite' } });
    mgr.registerDriver('sqlite', factory);

    const c = mgr.connection();
    expect(c).toBeDefined();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('throws when connection config is missing', () => {
    const mgr = new DatabaseManager('sqlite', { sqlite: { driver: 'memory' } });
    mgr.registerDriver('memory', () => makeAdapter().adapter);

    expect(() => mgr.connection('missing')).toThrow(/is not configured/i);
  });

  it('throws when driver is not registered', () => {
    const mgr = new DatabaseManager('sqlite', { sqlite: { driver: 'unknown' } });
    expect(() => mgr.connection()).toThrow(/is not registered/i);
  });

  it('disconnect(name) removes cached instance and calls disconnect()', async () => {
    const created: Array<{ adapter: TestAdapter; disconnect: ReturnType<typeof vi.fn> }> = [];
    const factory = vi.fn(() => {
      const item = makeAdapter();
      created.push(item);
      return item.adapter;
    });

    const mgr = new DatabaseManager('sqlite', { sqlite: { driver: 'memory' } });
    mgr.registerDriver('memory', factory);

    const a1 = mgr.connection('sqlite');
    await mgr.disconnect('sqlite');

    expect(created).toHaveLength(1);
    expect(created[0].disconnect).toHaveBeenCalledTimes(1);

    const a2 = mgr.connection('sqlite');
    expect(a2).not.toBe(a1);
    expect(created).toHaveLength(2);
  });

  it('disconnectAll() disconnects every cached connection', async () => {
    const created: Array<{ adapter: TestAdapter; disconnect: ReturnType<typeof vi.fn> }> = [];
    const factory = vi.fn(() => {
      const item = makeAdapter();
      created.push(item);
      return item.adapter;
    });

    const mgr = new DatabaseManager('a', { a: { driver: 'd' }, b: { driver: 'd' } });
    mgr.registerDriver('d', factory);

    mgr.connection('a');
    mgr.connection('b');
    await mgr.disconnectAll();

    expect(created[0].disconnect).toHaveBeenCalledTimes(1);
    expect(created[1].disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnect(name) is a no-op when the connection is not cached', async () => {
    const mgr = new DatabaseManager('sqlite', { sqlite: { driver: 'memory' } });
    mgr.registerDriver('memory', () => makeAdapter().adapter);

    await mgr.disconnect('sqlite');
    await mgr.disconnectAll();
  });

  it('disconnect() skips calling disconnect() when the adapter does not implement it', async () => {
    const adapter = {
      execute: vi.fn(async () => [] as Record<string, unknown>[]),
      run: vi.fn(async () => ({ affectedRows: 0 })),
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } satisfies IDatabaseAdapter;

    const factory = vi.fn(() => adapter);
    const mgr = new DatabaseManager('sqlite', { sqlite: { driver: 'memory' } });
    mgr.registerDriver('memory', factory);

    // Create + disconnect without a 'disconnect' method.
    mgr.connection('sqlite');
    await mgr.disconnect('sqlite');

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('purge(name) delegates to disconnect(name)', async () => {
    const { adapter, disconnect } = makeAdapter();
    const factory = vi.fn(() => adapter);

    const mgr = new DatabaseManager('sqlite', { sqlite: { driver: 'memory' } });
    mgr.registerDriver('memory', factory);

    mgr.connection('sqlite');
    await mgr.purge('sqlite');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('exposes configuration/driver metadata helpers', () => {
    const mgr = new DatabaseManager('sqlite', {
      sqlite: { driver: 'memory' },
      pg: { driver: 'postgres' },
    });
    mgr.registerDriver('memory', () => makeAdapter().adapter);
    mgr.registerDriver('postgres', () => makeAdapter().adapter);

    expect(mgr.hasConnection('sqlite')).toBe(true);
    expect(mgr.hasConnection('missing')).toBe(false);
    expect(mgr.getConnectionNames().sort()).toEqual(['pg', 'sqlite']);
    expect(mgr.getDriverNames().sort()).toEqual(['memory', 'postgres']);

    mgr.setDefaultConnection('pg');
    expect(mgr.getDefaultConnection()).toBe('pg');
  });
});

