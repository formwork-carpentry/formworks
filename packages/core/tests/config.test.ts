/**
 * @module @formwork/core
 * @description Tests for Config system (CARP-008)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Config, env } from '../src/config/Config.js';

describe('CARP-008: Configuration System', () => {
  describe('Config — dot-notation access', () => {
    let config: Config;

    beforeEach(() => {
      config = new Config({
        app: { name: 'Carpenter', debug: true, port: 3000 },
        database: {
          default: 'postgres',
          connections: {
            postgres: { host: 'localhost', port: 5432, database: 'carpenter' },
            sqlite: { filename: ':memory:' },
          },
        },
      });
    });

    it('gets top-level values', () => {
      expect(config.get('app')).toEqual({ name: 'Carpenter', debug: true, port: 3000 });
    });

    it('gets nested values via dot notation', () => {
      expect(config.get<string>('app.name')).toBe('Carpenter');
      expect(config.get<number>('app.port')).toBe(3000);
      expect(config.get<string>('database.default')).toBe('postgres');
    });

    it('gets deeply nested values', () => {
      expect(config.get<string>('database.connections.postgres.host')).toBe('localhost');
      expect(config.get<number>('database.connections.postgres.port')).toBe(5432);
    });

    it('returns undefined for missing keys', () => {
      expect(config.get('nonexistent')).toBeUndefined();
      expect(config.get('app.nonexistent')).toBeUndefined();
      expect(config.get('deeply.nested.missing.key')).toBeUndefined();
    });

    it('returns default value for missing keys', () => {
      expect(config.get('nonexistent', 'fallback')).toBe('fallback');
      expect(config.get<number>('app.timeout', 5000)).toBe(5000);
    });

    it('does not return default when key exists', () => {
      expect(config.get('app.name', 'DefaultName')).toBe('Carpenter');
    });

    it('has() checks existence', () => {
      expect(config.has('app.name')).toBe(true);
      expect(config.has('nonexistent')).toBe(false);
    });

    it('set() creates values at dot paths', () => {
      config.set('cache.driver', 'redis');
      expect(config.get('cache.driver')).toBe('redis');
    });

    it('set() creates intermediate objects', () => {
      config.set('mail.smtp.host', 'smtp.example.com');
      expect(config.get('mail.smtp.host')).toBe('smtp.example.com');
    });

    it('all() returns shallow copy of config', () => {
      const all = config.all();
      expect(all).toHaveProperty('app');
      expect(all).toHaveProperty('database');
      // Mutation safety
      all['app'] = 'mutated';
      expect(config.get('app')).not.toBe('mutated');
    });

    it('merge() deep-merges config objects', () => {
      config.merge({
        app: { version: '1.0.0' },
        cache: { driver: 'redis' },
      });
      expect(config.get('app.name')).toBe('Carpenter'); // preserved
      expect(config.get('app.version')).toBe('1.0.0');  // added
      expect(config.get('cache.driver')).toBe('redis');  // new namespace
    });
  });

  describe('env() — environment variable reader', () => {
    beforeEach(() => {
      process.env['TEST_STRING'] = 'hello';
      process.env['TEST_NUMBER'] = '3000';
      process.env['TEST_BOOL_TRUE'] = 'true';
      process.env['TEST_BOOL_ONE'] = '1';
      process.env['TEST_BOOL_FALSE'] = 'false';
    });

    afterEach(() => {
      delete process.env['TEST_STRING'];
      delete process.env['TEST_NUMBER'];
      delete process.env['TEST_BOOL_TRUE'];
      delete process.env['TEST_BOOL_ONE'];
      delete process.env['TEST_BOOL_FALSE'];
    });

    it('reads string values', () => {
      expect(env('TEST_STRING')).toBe('hello');
    });

    it('returns default for missing keys', () => {
      expect(env('NONEXISTENT', 'fallback')).toBe('fallback');
    });

    it('coerces to number when default is number', () => {
      expect(env<number>('TEST_NUMBER', 0)).toBe(3000);
    });

    it('coerces to boolean when default is boolean', () => {
      expect(env<boolean>('TEST_BOOL_TRUE', false)).toBe(true);
      expect(env<boolean>('TEST_BOOL_ONE', false)).toBe(true);
      expect(env<boolean>('TEST_BOOL_FALSE', true)).toBe(false);
    });

    it('returns undefined for missing keys with no default', () => {
      expect(env('NONEXISTENT')).toBeUndefined();
    });
  });
});
