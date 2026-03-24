import { describe, it, expect } from 'vitest';
import { buildDefaultConfig } from '@carpentry/core/config';

describe('config/buildDefaultConfig', () => {
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

  it('provides standard database connections', () => {
    const cfg = buildDefaultConfig();
    expect(cfg.database.connections).toHaveProperty('memory');
    expect(cfg.database.connections).toHaveProperty('sqlite');
    expect(cfg.database.connections).toHaveProperty('postgres');
    expect(cfg.database.connections).toHaveProperty('mysql');
  });
});
