import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationScanner } from '../../../carpenter/cli/src/migration-guide.js';

describe('migration/MigrationScanner', () => {
  let scanner: MigrationScanner;

  beforeEach(() => {
    scanner = new MigrationScanner();
  });

  describe('scanText', () => {
    it('detects deprecated patterns and reports location', () => {
      const source = "line1\nconst x = session.get('y');\nconst t = translator.trans('hello');";
      const matches = scanner.scanText('src/app.ts', source, '1.0');

      expect(matches.some((m) => m.rule.id === 'v1.0-session-async')).toBe(true);
      expect(matches.some((m) => m.rule.id === 'v1.0-translator-api')).toBe(true);

      const session = matches.find((m) => m.rule.id === 'v1.0-session-async');
      expect(session?.line).toBe(2);
      expect(session?.column).toBeGreaterThan(0);
    });

    it('ignores updated patterns and returns empty for clean code', () => {
      const source = "const x = await session.get('key');\nconst t = translator.get('hello');";
      const matches = scanner.scanText('clean.ts', source, '1.0');

      expect(matches.filter((m) => m.rule.id === 'v1.0-session-async')).toHaveLength(0);
      expect(matches.filter((m) => m.rule.id === 'v1.0-translator-api')).toHaveLength(0);
    });

    it('detects config env anti-pattern', () => {
      const source = "const db = process.env['DB_CONNECTION'];";
      const matches = scanner.scanText('src/config.ts', source, '1.0');
      expect(matches.some((m) => m.rule.id === 'v1.0-config-env')).toBe(true);
    });
  });

  describe('rules and reports', () => {
    it('supports custom rule registration', () => {
      scanner.addRule({
        id: 'custom-1',
        description: 'Old API removed',
        targetVersion: '2.0',
        pattern: /oldFunction\(\)/g,
        severity: 'breaking',
      });

      const matches = scanner.scanText('src/app.ts', 'oldFunction()', '2.0');
      expect(matches).toHaveLength(1);
      expect(matches[0].rule.id).toBe('custom-1');
    });

    it('formats reports and handles empty matches', () => {
      const report = scanner.formatReport(scanner.scanText('src/app.ts', "session.get('x')", '1.0'));
      expect(report).toContain('Migration Report');
      expect(report).toContain('src/app.ts');

      expect(scanner.formatReport([])).toContain('up to date');
    });

    it('returns rules by version', () => {
      const v1Rules = scanner.getRulesForVersion('1.0');
      expect(v1Rules.length).toBeGreaterThan(0);
      expect(v1Rules.every((r) => r.targetVersion === '1.0')).toBe(true);
      expect(scanner.getRulesForVersion('99.0')).toHaveLength(0);
    });
  });
});
