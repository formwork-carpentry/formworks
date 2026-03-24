/**
 * @module tests
 * @description Tests for the config-driven infrastructure wiring system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { Config, env } from '@carpentry/core/config';
import { loadEnv, parseEnvString, envRequired } from '@carpentry/core/config';
import { ConfigResolver } from '@carpentry/core/config';
import { buildDefaultConfig } from '@carpentry/core/config';
import { DatabaseManager } from '../src/db/factory/index.ts';
import { SQLiteMemoryAdapter } from '../packages/db-memory/src/index.ts';
import { CacheManager } from '../src/cache/manager/CacheManager.ts';
import { QueueManager } from '../src/queue/manager/QueueManager.ts';
import { MailManager } from '../src/mail/manager/MailManager.ts';
import { StorageManager } from '../src/storage/manager/StorageManager.ts';
import { LocalStorageAdapter } from '../src/storage/adapters/LocalStorageAdapter.ts';
import { MemoryStorageAdapter } from '../src/storage/adapters/MemoryStorageAdapter.ts';

const TEST_DIR = '/tmp/carpenter-config-test-' + Date.now();

// ═══════════════════════════════════════════════════════════
// ENV LOADER
// ═══════════════════════════════════════════════════════════

describe('EnvLoader', () => {
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  describe('parseEnvString', () => {
    it('parses key=value pairs', () => {
      const result = parseEnvString('APP_NAME=Carpenter\nAPP_DEBUG=true');
      expect(result.get('APP_NAME')).toBe('Carpenter');
      expect(result.get('APP_DEBUG')).toBe('true');
    });

    it('ignores comments and empty lines', () => {
      const result = parseEnvString('# This is a comment\n\nAPP_NAME=Test\n# Another comment');
      expect(result.size).toBe(1);
      expect(result.get('APP_NAME')).toBe('Test');
    });

    it('strips double quotes', () => {
      const result = parseEnvString('APP_NAME="My App"');
      expect(result.get('APP_NAME')).toBe('My App');
    });

    it('strips single quotes', () => {
      const result = parseEnvString("APP_KEY='secret-key-123'");
      expect(result.get('APP_KEY')).toBe('secret-key-123');
    });

    it('handles values with = signs', () => {
      const result = parseEnvString('DATABASE_URL=postgres://user:pass@host/db?sslmode=require');
      expect(result.get('DATABASE_URL')).toBe('postgres://user:pass@host/db?sslmode=require');
    });

    it('handles empty values', () => {
      const result = parseEnvString('EMPTY_VAR=');
      expect(result.get('EMPTY_VAR')).toBe('');
    });

    it('handles escape sequences in double quotes', () => {
      const result = parseEnvString('MSG="line1\\nline2"');
      expect(result.get('MSG')).toBe('line1\nline2');
    });

    it('strips inline comments for unquoted values', () => {
      const result = parseEnvString('PORT=3000 # the default port');
      expect(result.get('PORT')).toBe('3000');
    });
  });

  describe('loadEnv', () => {
    it('loads .env file into process.env', async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(join(TEST_DIR, '.env'), 'TEST_CARPENTER_VAR=hello_from_env\n');

      const saved = process.env['TEST_CARPENTER_VAR'];
      try {
        await loadEnv({ path: join(TEST_DIR, '.env') });
        expect(process.env['TEST_CARPENTER_VAR']).toBe('hello_from_env');
      } finally {
        if (saved !== undefined) process.env['TEST_CARPENTER_VAR'] = saved;
        else delete process.env['TEST_CARPENTER_VAR'];
      }
    });

    it('does not override existing env vars by default', async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(join(TEST_DIR, '.env'), 'PATH=/overridden\n');

      const originalPath = process.env['PATH'];
      await loadEnv({ path: join(TEST_DIR, '.env') });
      expect(process.env['PATH']).toBe(originalPath);
    });

    it('overrides when option is set', async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(join(TEST_DIR, '.env'), 'TEST_OVERRIDE_VAR=original\n');

      process.env['TEST_OVERRIDE_VAR'] = 'existing';
      try {
        await loadEnv({ path: join(TEST_DIR, '.env'), override: true });
        expect(process.env['TEST_OVERRIDE_VAR']).toBe('original');
      } finally {
        delete process.env['TEST_OVERRIDE_VAR'];
      }
    });

    it('loads extra files', async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(join(TEST_DIR, '.env'), 'BASE=yes\n');
      await fs.writeFile(join(TEST_DIR, '.env.local'), 'LOCAL=yes\n');

      const saved1 = process.env['BASE'];
      const saved2 = process.env['LOCAL'];
      try {
        await loadEnv({ path: join(TEST_DIR, '.env'), extraFiles: ['.env.local'] });
        expect(process.env['BASE']).toBe('yes');
        expect(process.env['LOCAL']).toBe('yes');
      } finally {
        if (saved1 !== undefined) process.env['BASE'] = saved1; else delete process.env['BASE'];
        if (saved2 !== undefined) process.env['LOCAL'] = saved2; else delete process.env['LOCAL'];
      }
    });

    it('silently skips missing files', async () => {
      const result = await loadEnv({ path: '/nonexistent/.env' });
      expect(result.size).toBe(0);
    });
  });

  describe('envRequired', () => {
    it('returns value when set', () => {
      process.env['TEST_REQ'] = 'present';
      try {
        expect(envRequired('TEST_REQ')).toBe('present');
      } finally {
        delete process.env['TEST_REQ'];
      }
    });

    it('throws when missing', () => {
      delete process.env['SURELY_MISSING_VAR'];
      expect(() => envRequired('SURELY_MISSING_VAR')).toThrow('Missing required environment variable');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// BUILD DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════

describe('buildDefaultConfig', () => {
  it('returns all standard sections', () => {
    const cfg = buildDefaultConfig();
    expect(cfg).toHaveProperty('app');
    expect(cfg).toHaveProperty('database');
    expect(cfg).toHaveProperty('cache');
    expect(cfg).toHaveProperty('queue');
    expect(cfg).toHaveProperty('mail');
    expect(cfg).toHaveProperty('storage');
    expect(cfg).toHaveProperty('session');
    expect(cfg).toHaveProperty('logging');
    expect(cfg).toHaveProperty('auth');
  });

  it('reads from env vars when set', () => {
    process.env['APP_NAME'] = 'TestApp';
    try {
      const cfg = buildDefaultConfig();
      expect(cfg.app.name).toBe('TestApp');
    } finally {
      delete process.env['APP_NAME'];
    }
  });

  it('uses sensible defaults', () => {
    const cfg = buildDefaultConfig();
    expect(cfg.database.default).toBe('memory');
    expect(cfg.cache.default).toBe('memory');
    expect(cfg.queue.default).toBe('sync');
    expect(cfg.mail.default).toBe('log');
  });

  it('database has memory, sqlite, postgres, mysql connections', () => {
    const cfg = buildDefaultConfig();
    expect(cfg.database.connections).toHaveProperty('memory');
    expect(cfg.database.connections).toHaveProperty('sqlite');
    expect(cfg.database.connections).toHaveProperty('postgres');
    expect(cfg.database.connections).toHaveProperty('mysql');
  });
});

// ═══════════════════════════════════════════════════════════
// CONFIG RESOLVER
// ═══════════════════════════════════════════════════════════

describe('ConfigResolver', () => {
  let resolver: ConfigResolver;

  beforeEach(() => {
    resolver = new ConfigResolver(new Config(buildDefaultConfig()));
  });

  it('resolves default database connection', () => {
    expect(resolver.dbConnection()).toBe('memory');
  });

  it('resolves default cache driver', () => {
    expect(resolver.cacheDriver()).toBe('memory');
  });

  it('resolves default queue connection', () => {
    expect(resolver.queueConnection()).toBe('sync');
  });

  it('resolves default mail mailer', () => {
    expect(resolver.mailMailer()).toBe('log');
  });

  it('resolves default storage disk', () => {
    expect(resolver.storageDisk()).toBe('local');
  });

  it('resolves session driver', () => {
    expect(resolver.sessionDriver()).toBe('memory');
  });

  it('resolves app environment info', () => {
    expect(resolver.appName()).toBe('Carpenter');
    expect(resolver.isDevelopment()).toBe(true);
    expect(resolver.isProduction()).toBe(false);
  });

  it('resolves database connection config', () => {
    const pgConfig = resolver.dbConnectionConfig('postgres');
    expect(pgConfig).toHaveProperty('driver', 'postgres');
    expect(pgConfig).toHaveProperty('host');
    expect(pgConfig).toHaveProperty('port');
  });

  it('resolves mail from address', () => {
    const from = resolver.mailFrom();
    expect(from.address).toBe('noreply@example.com');
    expect(from.name).toBe('Carpenter');
  });

  it('respects env overrides', () => {
    process.env['DB_CONNECTION'] = 'postgres';
    try {
      const r = new ConfigResolver(new Config(buildDefaultConfig()));
      expect(r.dbConnection()).toBe('postgres');
    } finally {
      delete process.env['DB_CONNECTION'];
    }
  });
});

// ═══════════════════════════════════════════════════════════
// DATABASE MANAGER
// ═══════════════════════════════════════════════════════════

describe('DatabaseManager', () => {
  let manager: DatabaseManager;

  beforeEach(() => {
    const cfg = buildDefaultConfig();
    manager = new DatabaseManager(
      cfg.database.default as string,
      cfg.database.connections as Record<string, Record<string, unknown>>,
    );
    manager.registerDriver('memory', () => new SQLiteMemoryAdapter());
  });

  it('resolves default connection', () => {
    const db = manager.connection();
    expect(db.driverName()).toBe('sqlite-memory');
  });

  it('resolves named connection', () => {
    manager.registerDriver('sqlite', () => new SQLiteMemoryAdapter());
    const db = manager.connection('sqlite');
    expect(db).toBeTruthy();
  });

  it('caches connections (singleton per name)', () => {
    const db1 = manager.connection();
    const db2 = manager.connection();
    expect(db1).toBe(db2);
  });

  it('throws for unconfigured connection', () => {
    expect(() => manager.connection('nonexistent')).toThrow('not configured');
  });

  it('throws for unregistered driver', () => {
    expect(() => manager.connection('postgres')).toThrow('not registered');
  });

  it('lists connection names', () => {
    const names = manager.getConnectionNames();
    expect(names).toContain('memory');
    expect(names).toContain('postgres');
    expect(names).toContain('mysql');
  });

  it('lists driver names', () => {
    expect(manager.getDriverNames()).toContain('memory');
  });

  it('checks connection existence', () => {
    expect(manager.hasConnection('memory')).toBe(true);
    expect(manager.hasConnection('oracle')).toBe(false);
  });

  it('disconnects a connection', async () => {
    manager.connection(); // create it
    await manager.disconnect();
    // Next call should create a new instance
    const db = manager.connection();
    expect(db).toBeTruthy();
  });

  it('disconnects all', async () => {
    manager.registerDriver('sqlite', () => new SQLiteMemoryAdapter());
    manager.connection('memory');
    manager.connection('sqlite');
    await manager.disconnectAll();
  });

  it('changes default connection', () => {
    manager.registerDriver('sqlite', () => new SQLiteMemoryAdapter());
    manager.setDefaultConnection('sqlite');
    expect(manager.getDefaultConnection()).toBe('sqlite');
    const db = manager.connection();
    expect(db).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// CONFIG-DRIVEN WIRING (Integration)
// ═══════════════════════════════════════════════════════════

describe('Config-Driven Wiring', () => {
  it('builds complete infrastructure from config', () => {
    const config = new Config(buildDefaultConfig());
    const resolver = new ConfigResolver(config);

    // Database
    const dbManager = new DatabaseManager(resolver.dbConnection(), resolver.dbConnections() as Record<string, Record<string, unknown>>);
    dbManager.registerDriver('memory', () => new SQLiteMemoryAdapter());
    const db = dbManager.connection();
    expect(db.driverName()).toBe('sqlite-memory');

    // Cache
    const cacheManager = new CacheManager(resolver.cacheDriver(), resolver.cacheStores() as Record<string, { driver: string }> as Record<string, { driver: string; [key: string]: unknown }>);
    const cache = cacheManager.store();
    expect(cache).toBeTruthy();

    // Queue
    const queueManager = new QueueManager(resolver.queueConnection(), resolver.queueConnections());
    const queue = queueManager.connection();
    expect(queue).toBeTruthy();

    // Mail
    const mailManager = new MailManager(resolver.mailMailer(), resolver.mailMailers());
    const mailer = mailManager.mailer();
    expect(mailer).toBeTruthy();

    // Storage
    const storageManager = new StorageManager(resolver.storageDisk(), resolver.storageDisks());
    storageManager.registerDriver('local', (cfg) => new LocalStorageAdapter({ root: (cfg['root'] as string) ?? '/tmp' }));
    const disk = storageManager.disk();
    expect(disk).toBeTruthy();
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

  it('config.set() overrides values at runtime', () => {
    const config = new Config(buildDefaultConfig());

    config.set('database.default', 'postgres');
    config.set('cache.default', 'file');

    const resolver = new ConfigResolver(config);
    expect(resolver.dbConnection()).toBe('postgres');
    expect(resolver.cacheDriver()).toBe('file');
  });
});
