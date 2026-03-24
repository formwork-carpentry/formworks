import { describe, it, expect } from 'vitest';
import { Config } from '@carpentry/core/config';
import { ConfigResolver } from '@carpentry/core/config';
import { buildDefaultConfig } from '@carpentry/core/config';
import { DatabaseManager } from '../../src/db/factory/index.ts';
import { SQLiteMemoryAdapter } from '../../packages/db-memory/src/index.ts';
import { CacheManager } from '../../src/cache/manager/CacheManager.ts';
import { QueueManager } from '../../src/queue/manager/QueueManager.ts';
import { MailManager } from '../../src/mail/manager/MailManager.ts';
import { StorageManager } from '../../src/storage/manager/StorageManager.ts';
import { LocalStorageAdapter } from '../../src/storage/adapters/LocalStorageAdapter.ts';

describe('config/Wiring', () => {
  it('builds complete infrastructure from config', () => {
    const config = new Config(buildDefaultConfig());
    const resolver = new ConfigResolver(config);

    const dbManager = new DatabaseManager(
      resolver.dbConnection(),
      resolver.dbConnections() as Record<string, Record<string, unknown>>,
    );
    dbManager.registerDriver('memory', () => new SQLiteMemoryAdapter());
    expect(dbManager.connection().driverName()).toBe('sqlite-memory');

    const cacheManager = new CacheManager(
      resolver.cacheDriver(),
      resolver.cacheStores() as Record<string, { driver: string; [key: string]: unknown }>,
    );
    expect(cacheManager.store()).toBeTruthy();

    const queueManager = new QueueManager(resolver.queueConnection(), resolver.queueConnections());
    expect(queueManager.connection()).toBeTruthy();

    const mailManager = new MailManager(resolver.mailMailer(), resolver.mailMailers());
    expect(mailManager.mailer()).toBeTruthy();

    const storageManager = new StorageManager(resolver.storageDisk(), resolver.storageDisks());
    storageManager.registerDriver('local', (cfg) =>
      new LocalStorageAdapter({ root: (cfg['root'] as string) ?? '/tmp' }),
    );
    expect(storageManager.disk()).toBeTruthy();
  });

  it('switches drivers via env vars', () => {
    process.env['DB_CONNECTION'] = 'sqlite';
    process.env['CACHE_DRIVER'] = 'null';
    process.env['QUEUE_CONNECTION'] = 'memory';

    try {
      const config = new Config(buildDefaultConfig());
      const resolver = new ConfigResolver(config);
      expect(resolver.dbConnection()).toBe('sqlite');
      expect(resolver.cacheDriver()).toBe('null');
      expect(resolver.queueConnection()).toBe('memory');
    } finally {
      delete process.env['DB_CONNECTION'];
      delete process.env['CACHE_DRIVER'];
      delete process.env['QUEUE_CONNECTION'];
    }
  });

  it('allows runtime config overrides', () => {
    const config = new Config(buildDefaultConfig());
    config.set('database.default', 'postgres');
    config.set('cache.default', 'file');

    const resolver = new ConfigResolver(config);
    expect(resolver.dbConnection()).toBe('postgres');
    expect(resolver.cacheDriver()).toBe('file');
  });
});
