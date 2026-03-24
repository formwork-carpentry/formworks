import { describe, it, expect } from 'vitest';
import { runSecurityAudit, SecurityAuditCommand } from '../../../carpenter/cli/src/security-audit.js';
import { InMemoryConsole } from '../../../carpenter/cli/src/index.js';

describe('security/runSecurityAudit', () => {
  it('passes with secure production config', () => {
    const results = runSecurityAudit({
      APP_KEY: 'a'.repeat(32),
      APP_ENV: 'production',
      APP_DEBUG: 'false',
      APP_URL: 'https://myapp.com',
      CORS_ORIGIN: 'https://myapp.com',
      SESSION_SECURE_COOKIE: 'true',
      JWT_SECRET: 'proper-jwt-secret-key-here',
      DB_PASSWORD: 'strong-db-password-123',
      RATE_LIMIT_MAX: '100',
    });

    const failures = results.filter((r) => !r.result.passed);
    expect(failures).toHaveLength(0);
  });

  it('catches insecure configuration scenarios', () => {
    const appKey = runSecurityAudit({ APP_KEY: '' }).find((r) => r.check.name === 'APP_KEY set');
    const debug = runSecurityAudit({ APP_ENV: 'production', APP_DEBUG: 'true' }).find(
      (r) => r.check.name === 'Debug mode',
    );
    const cors = runSecurityAudit({ APP_ENV: 'production', CORS_ORIGIN: '*' }).find(
      (r) => r.check.name === 'CORS configuration',
    );
    const session = runSecurityAudit({ APP_ENV: 'production', SESSION_SECURE_COOKIE: 'false' }).find(
      (r) => r.check.name === 'Session security',
    );
    const https = runSecurityAudit({ APP_ENV: 'production', APP_URL: 'http://myapp.com' }).find(
      (r) => r.check.name === 'HTTPS enforcement',
    );
    const db = runSecurityAudit({ APP_ENV: 'production', DB_PASSWORD: '' }).find(
      (r) => r.check.name === 'Database credentials',
    );

    expect(appKey?.result.passed).toBe(false);
    expect(debug?.result.passed).toBe(false);
    expect(cors?.result.passed).toBe(false);
    expect(session?.result.passed).toBe(false);
    expect(https?.result.passed).toBe(false);
    expect(db?.result.passed).toBe(false);
  });

  it('allows development debug mode', () => {
    const results = runSecurityAudit({ APP_ENV: 'development', APP_DEBUG: 'true' });
    const debug = results.find((r) => r.check.name === 'Debug mode');
    expect(debug?.result.passed).toBe(true);
  });
});

describe('security/SecurityAuditCommand', () => {
  it('runs via CLI and outputs report', async () => {
    const output = new InMemoryConsole();
    const cmd = new SecurityAuditCommand();
    const code = await cmd.handle({}, {}, output);

    output.assertOutputContains('Security Audit');
    expect(typeof code).toBe('number');
  });
});
