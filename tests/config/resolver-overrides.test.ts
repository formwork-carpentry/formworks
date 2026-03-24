import { describe, expect, it } from 'vitest';

import { Config, ConfigResolver, buildDefaultConfig } from '@carpentry/core/config';

describe('config/resolver-overrides', () => {
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
