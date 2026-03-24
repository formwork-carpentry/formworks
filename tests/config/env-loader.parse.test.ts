import { describe, it, expect } from 'vitest';
import { parseEnvString } from '@carpentry/core/config';

describe('config/EnvLoader parseEnvString', () => {
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
