import { describe, expect, it } from 'vitest';

import { Config, ConfigResolver, buildDefaultConfig } from '@carpentry/core/config';
import { CacheManager } from '../../src/cache/manager/CacheManager.ts';
import { DatabaseManager } from '../../src/db/factory/index.ts';
import { MailManager } from '../../src/mail/manager/MailManager.ts';
import { QueueManager } from '../../src/queue/manager/QueueManager.ts';
import { LocalStorageAdapter } from '../../src/storage/adapters/LocalStorageAdapter.ts';
import { StorageManager } from '../../src/storage/manager/StorageManager.ts';
import { SQLiteMemoryAdapter } from '../../packages/db-memory/src/index.ts';

describe('integration/infrastructure-wiring', () => {
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
});
