import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, parseEnvString, envRequired } from '@carpentry/core/config';

const TEST_DIR = `/tmp/carpenter-config-test-${Date.now()}`;

describe('config/EnvLoader', () => {
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

    it('strips quotes and preserves values with equals', () => {
      expect(parseEnvString('APP_NAME="My App"').get('APP_NAME')).toBe('My App');
      expect(parseEnvString("APP_KEY='secret-key-123'").get('APP_KEY')).toBe('secret-key-123');
      expect(parseEnvString('DATABASE_URL=postgres://user:pass@host/db?sslmode=require').get('DATABASE_URL'))
        .toBe('postgres://user:pass@host/db?sslmode=require');
    });

    it('handles empty values and escapes', () => {
      expect(parseEnvString('EMPTY_VAR=').get('EMPTY_VAR')).toBe('');
      expect(parseEnvString('MSG="line1\\nline2"').get('MSG')).toBe('line1\nline2');
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
        if (saved1 !== undefined) process.env['BASE'] = saved1;
        else delete process.env['BASE'];
        if (saved2 !== undefined) process.env['LOCAL'] = saved2;
        else delete process.env['LOCAL'];
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
