import { describe, it, expect, beforeEach } from 'vitest';
import { buildDefaultConfig } from '@carpentry/core/config';
import { DatabaseManager } from '../../src/db/factory/index.ts';
import { SQLiteMemoryAdapter } from '../../packages/db-memory/src/index.ts';

describe('db/DatabaseManager', () => {
  let manager: DatabaseManager;

  beforeEach(() => {
    const cfg = buildDefaultConfig();
    manager = new DatabaseManager(
      cfg.database.default as string,
      cfg.database.connections as Record<string, Record<string, unknown>>,
    );
    manager.registerDriver('memory', () => new SQLiteMemoryAdapter());
  });

  it('resolves default and named connections', () => {
    expect(manager.connection().driverName()).toBe('sqlite-memory');

    manager.registerDriver('sqlite', () => new SQLiteMemoryAdapter());
    expect(manager.connection('sqlite')).toBeTruthy();
  });

  it('caches connections by name', () => {
    const db1 = manager.connection();
    const db2 = manager.connection();
    expect(db1).toBe(db2);
  });

  it('throws for unconfigured or unregistered connections', () => {
    expect(() => manager.connection('nonexistent')).toThrow('not configured');
    expect(() => manager.connection('postgres')).toThrow('not registered');
  });

  it('reports connection and driver names', () => {
    const names = manager.getConnectionNames();
    expect(names).toContain('memory');
    expect(names).toContain('postgres');
    expect(names).toContain('mysql');
    expect(manager.getDriverNames()).toContain('memory');
  });

  it('checks connection existence', () => {
    expect(manager.hasConnection('memory')).toBe(true);
    expect(manager.hasConnection('oracle')).toBe(false);
  });

  it('disconnects one or all connections', async () => {
    manager.connection();
    await manager.disconnect();
    expect(manager.connection()).toBeTruthy();

    manager.registerDriver('sqlite', () => new SQLiteMemoryAdapter());
    manager.connection('sqlite');
    await manager.disconnectAll();
  });

  it('supports changing default connection', () => {
    manager.registerDriver('sqlite', () => new SQLiteMemoryAdapter());
    manager.setDefaultConnection('sqlite');
    expect(manager.getDefaultConnection()).toBe('sqlite');
    expect(manager.connection()).toBeTruthy();
  });
});
