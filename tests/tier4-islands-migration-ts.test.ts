/**
 * @module tests
 * @description Tests for Islands architecture, Migration scanner, and TS CompletionProvider
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════
// ISLANDS ARCHITECTURE
// ═══════════════════════════════════════════════════════════

import { Island, IslandRenderer } from '../packages/ui/src/Islands.js';
import type { IslandDefinition } from '../packages/ui/src/Islands.js';

describe('Islands Architecture', () => {
  let renderer: IslandRenderer;

  beforeEach(() => { renderer = new IslandRenderer(); });

  describe('Island()', () => {
    it('creates an island definition with defaults', () => {
      const counter = Island({
        name: 'Counter',
        render: (props: { initial: number }) => `<button>Count: ${props.initial}</button>`,
      });
      expect(counter.name).toBe('Counter');
      expect(counter.hydrate).toBe('lazy'); // default
    });

    it('respects custom hydration strategy', () => {
      const search = Island({
        name: 'SearchBar',
        render: () => '<input type="search" />',
        hydrate: 'eager',
      });
      expect(search.hydrate).toBe('eager');
    });
  });

  describe('IslandRenderer.island()', () => {
    it('renders server HTML wrapped in <carpenter-island>', () => {
      const counter = Island({
        name: 'Counter',
        render: (props: { n: number }) => `<span>${props.n}</span>`,
      });

      const html = renderer.island(counter, { n: 42 });

      expect(html).toContain('<carpenter-island');
      expect(html).toContain('data-island="Counter"');
      expect(html).toContain('<span>42</span>');
      expect(html).toContain('data-hydrate="lazy"');
    });

    it('serializes props as data-props attribute', () => {
      const widget = Island({
        name: 'Widget',
        render: () => '<div>Widget</div>',
      });

      const html = renderer.island(widget, { color: 'red', size: 10 });

      expect(html).toContain('data-props=');
      // Props should be escaped for HTML attributes
      expect(html).not.toContain('"color"'); // raw JSON should be escaped
    });

    it('includes client entry path', () => {
      const chart = Island({
        name: 'Chart',
        render: () => '<canvas></canvas>',
        clientEntry: '/islands/Chart.tsx',
      });

      const html = renderer.island(chart, {});
      expect(html).toContain('data-entry="/islands/Chart.tsx"');
    });

    it('defaults client entry to /islands/{name}.js', () => {
      const counter = Island({ name: 'Counter', render: () => '' });
      const html = renderer.island(counter, {});
      expect(html).toContain('data-entry="/islands/Counter.js"');
    });

    it('includes media query for media strategy', () => {
      const desktop = Island({
        name: 'DesktopNav',
        render: () => '<nav>Desktop Nav</nav>',
        hydrate: 'media',
        mediaQuery: '(min-width: 768px)',
      });

      const html = renderer.island(desktop, {});
      expect(html).toContain('data-hydrate="media"');
      expect(html).toContain('data-media="(min-width: 768px)"');
    });
  });

  describe('IslandRenderer.renderPage()', () => {
    it('appends loader script when islands are used', () => {
      const btn = Island({ name: 'Btn', render: () => '<button>Click</button>' });
      const body = `<h1>Page</h1>${renderer.island(btn, {})}`;
      const html = renderer.renderPage(body);

      expect(html).toContain('<h1>Page</h1>');
      expect(html).toContain('<script type="module">');
      expect(html).toContain('carpenter-island');
    });

    it('no script when no islands used', () => {
      const html = renderer.renderPage('<h1>Static Page</h1>');
      expect(html).not.toContain('<script');
    });
  });

  describe('tracking', () => {
    it('getUsedIslands returns all rendered islands', () => {
      const a = Island({ name: 'A', render: () => 'A' });
      const b = Island({ name: 'B', render: () => 'B' });

      renderer.island(a, {});
      renderer.island(b, {});

      expect(renderer.getUsedIslands()).toHaveLength(2);
      expect(renderer.getUsedIslands()[0].name).toBe('A');
    });

    it('reset() clears used islands', () => {
      const a = Island({ name: 'A', render: () => 'A' });
      renderer.island(a, {});
      renderer.reset();
      expect(renderer.getUsedIslands()).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// MIGRATION SCANNER
// ═══════════════════════════════════════════════════════════

import { MigrationScanner } from '../packages/cli/src/migration-guide.js';

describe('MigrationScanner', () => {
  let scanner: MigrationScanner;

  beforeEach(() => { scanner = new MigrationScanner(); });

  describe('scanText', () => {
    it('detects deprecated session usage', () => {
      const source = `
        const name = session.get('name');
        session.put('key', 'value');
      `;
      const matches = scanner.scanText('src/app.ts', source, '1.0');
      const sessionMatches = matches.filter((m) => m.rule.id === 'v1.0-session-async');
      expect(sessionMatches.length).toBeGreaterThan(0);
    });

    it('does not flag awaited session calls', () => {
      const source = `const name = await session.get('name');`;
      const matches = scanner.scanText('src/app.ts', source, '1.0');
      const sessionMatches = matches.filter((m) => m.rule.id === 'v1.0-session-async');
      expect(sessionMatches).toHaveLength(0);
    });

    it('detects deprecated translator API', () => {
      const source = `const msg = translator.trans('hello');`;
      const matches = scanner.scanText('src/lang.ts', source, '1.0');
      expect(matches.some((m) => m.rule.id === 'v1.0-translator-api')).toBe(true);
    });

    it('detects direct process.env config reads', () => {
      const source = `const db = process.env['DB_CONNECTION'];`;
      const matches = scanner.scanText('src/config.ts', source, '1.0');
      expect(matches.some((m) => m.rule.id === 'v1.0-config-env')).toBe(true);
    });

    it('returns line and column numbers', () => {
      const source = `line1\nconst x = session.get('y');\nline3`;
      const matches = scanner.scanText('test.ts', source, '1.0');
      const m = matches.find((m) => m.rule.id === 'v1.0-session-async');
      expect(m?.line).toBe(2);
      expect(m?.column).toBeGreaterThan(0);
    });

    it('returns empty for clean code', () => {
      const source = `const x = await session.get('key');\nconst t = translator.get('hello');`;
      const matches = scanner.scanText('clean.ts', source, '1.0');
      // Should not flag awaited session or translator.get
      const sessionMatches = matches.filter((m) => m.rule.id === 'v1.0-session-async');
      const translatorMatches = matches.filter((m) => m.rule.id === 'v1.0-translator-api');
      expect(sessionMatches).toHaveLength(0);
      expect(translatorMatches).toHaveLength(0);
    });
  });

  describe('custom rules', () => {
    it('supports adding custom migration rules', () => {
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
  });

  describe('formatReport', () => {
    it('generates a readable report', () => {
      const matches = scanner.scanText('src/app.ts', `session.get('x')`, '1.0');
      const report = scanner.formatReport(matches);
      expect(report).toContain('Migration Report');
      expect(report).toContain('src/app.ts');
    });

    it('returns clean message when no issues', () => {
      expect(scanner.formatReport([])).toContain('up to date');
    });
  });

  describe('getRulesForVersion', () => {
    it('returns only rules for the specified version', () => {
      const v1Rules = scanner.getRulesForVersion('1.0');
      expect(v1Rules.length).toBeGreaterThan(0);
      expect(v1Rules.every((r) => r.targetVersion === '1.0')).toBe(true);
    });

    it('returns empty for unknown version', () => {
      expect(scanner.getRulesForVersion('99.0')).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// TS COMPLETION PROVIDER
// ═══════════════════════════════════════════════════════════

import { CompletionProvider, KNOWN_BINDINGS, KNOWN_CONFIG_PATHS } from '@carpentry/core/plugin';

describe('CompletionProvider (TS Plugin)', () => {
  let provider: CompletionProvider;

  beforeEach(() => { provider = new CompletionProvider(); });

  describe('binding completions', () => {
    it('returns all bindings with empty prefix', () => {
      const items = provider.getBindingCompletions('');
      expect(items.length).toBe(KNOWN_BINDINGS.length);
    });

    it('filters bindings by prefix', () => {
      const items = provider.getBindingCompletions('cache');
      expect(items.length).toBe(2); // 'cache' and 'cache.manager'
      expect(items.every((i) => i.label.startsWith('cache'))).toBe(true);
    });

    it('returns empty for no match', () => {
      expect(provider.getBindingCompletions('zzzzz')).toHaveLength(0);
    });
  });

  describe('config completions', () => {
    it('returns all config paths with empty prefix', () => {
      expect(provider.getConfigCompletions('').length).toBe(KNOWN_CONFIG_PATHS.length);
    });

    it('filters by prefix', () => {
      const items = provider.getConfigCompletions('app.');
      expect(items.length).toBeGreaterThan(3);
      expect(items.every((i) => i.label.startsWith('app.'))).toBe(true);
    });
  });

  describe('validation', () => {
    it('validates known bindings', () => {
      expect(provider.validateBinding('db')).toBeNull();
      expect(provider.validateBinding('cache')).toBeNull();
    });

    it('returns error for unknown binding', () => {
      const err = provider.validateBinding('nonexistent');
      expect(err).toContain('Unknown container binding');
    });

    it('validates known config paths', () => {
      expect(provider.validateConfigPath('app.name')).toBeNull();
    });

    it('returns error with suggestions for unknown config path', () => {
      const err = provider.validateConfigPath('app.nonexistent');
      expect(err).toContain('Unknown config path');
      expect(err).toContain('Did you mean');
    });
  });

  describe('type info', () => {
    it('returns type and description for known binding', () => {
      const info = provider.getBindingType('db');
      expect(info?.type).toBe('IDatabaseAdapter');
      expect(info?.description).toContain('database');
    });

    it('returns null for unknown binding', () => {
      expect(provider.getBindingType('unknown')).toBeNull();
    });
  });

  describe('custom entries', () => {
    it('supports adding custom bindings', () => {
      provider.addBinding({ label: 'stripe', type: 'StripeClient', description: 'Stripe API', category: 'binding' });
      expect(provider.getBindingCompletions('stripe')).toHaveLength(1);
      expect(provider.validateBinding('stripe')).toBeNull();
    });

    it('supports adding custom config paths', () => {
      provider.addConfigPath({ label: 'stripe.key', type: 'string', description: 'Stripe API key', category: 'config' });
      expect(provider.getConfigCompletions('stripe.')).toHaveLength(1);
    });
  });
});
