import { describe, it, expect, beforeEach } from 'vitest';
import { Config } from '@carpentry/core/config';
import { ConfigResolver } from '@carpentry/core/config';
import { buildDefaultConfig } from '@carpentry/core/config';

describe('config/ConfigResolver', () => {
  let resolver: ConfigResolver;

  beforeEach(() => {
    resolver = new ConfigResolver(new Config(buildDefaultConfig()));
  });

  it('resolves default drivers and connections', () => {
    expect(resolver.dbConnection()).toBe('memory');
    expect(resolver.cacheDriver()).toBe('memory');
    expect(resolver.queueConnection()).toBe('sync');
    expect(resolver.mailMailer()).toBe('log');
    expect(resolver.storageDisk()).toBe('local');
    expect(resolver.sessionDriver()).toBe('memory');
  });

  it('resolves app environment info', () => {
    expect(resolver.appName()).toBe('Carpenter');
    expect(resolver.isDevelopment()).toBe(true);
    expect(resolver.isProduction()).toBe(false);
  });

  it('resolves database connection config and mail from', () => {
    const pgConfig = resolver.dbConnectionConfig('postgres');
    expect(pgConfig).toHaveProperty('driver', 'postgres');
    expect(pgConfig).toHaveProperty('host');
    expect(pgConfig).toHaveProperty('port');

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
