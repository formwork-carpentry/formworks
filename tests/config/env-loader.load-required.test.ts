import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, envRequired } from '@carpentry/core/config';

const TEST_DIR = `/tmp/carpenter-config-test-${Date.now()}`;

describe('config/EnvLoader loadEnv and envRequired', () => {
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

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
