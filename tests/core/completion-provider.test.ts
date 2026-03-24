import { describe, it, expect, beforeEach } from 'vitest';
import { CompletionProvider, KNOWN_BINDINGS, KNOWN_CONFIG_PATHS } from '@carpentry/formworks/tooling';

describe('core/CompletionProvider', () => {
  let provider: CompletionProvider;

  beforeEach(() => {
    provider = new CompletionProvider();
  });

  describe('binding completions', () => {
    it('returns all bindings for empty prefix and filters by prefix', () => {
      expect(provider.getBindingCompletions('').length).toBe(KNOWN_BINDINGS.length);

      const items = provider.getBindingCompletions('cache');
      expect(items.length).toBe(2);
      expect(items.every((i) => i.label.startsWith('cache'))).toBe(true);
    });

    it('returns empty when no binding matches', () => {
      expect(provider.getBindingCompletions('zzzzz')).toHaveLength(0);
    });
  });

  describe('config completions', () => {
    it('returns all paths for empty prefix and filters by app prefix', () => {
      expect(provider.getConfigCompletions('').length).toBe(KNOWN_CONFIG_PATHS.length);

      const items = provider.getConfigCompletions('app.');
      expect(items.length).toBeGreaterThan(3);
      expect(items.every((i) => i.label.startsWith('app.'))).toBe(true);
    });
  });

  describe('validation', () => {
    it('validates known bindings and config paths', () => {
      expect(provider.validateBinding('db')).toBeNull();
      expect(provider.validateBinding('cache')).toBeNull();
      expect(provider.validateConfigPath('app.name')).toBeNull();
    });

    it('returns helpful errors for unknown entries', () => {
      expect(provider.validateBinding('nonexistent')).toContain('Unknown container binding');

      const err = provider.validateConfigPath('app.nonexistent');
      expect(err).toContain('Unknown config path');
      expect(err).toContain('Did you mean');
    });
  });

  describe('type info and custom entries', () => {
    it('returns type info for known binding and null for unknown', () => {
      const info = provider.getBindingType('db');
      expect(info?.type).toBe('IDatabaseAdapter');
      expect(info?.description).toContain('database');
      expect(provider.getBindingType('unknown')).toBeNull();
    });

    it('supports adding custom bindings and config paths', () => {
      provider.addBinding({
        label: 'stripe',
        type: 'StripeClient',
        description: 'Stripe API',
        category: 'binding',
      });
      expect(provider.getBindingCompletions('stripe')).toHaveLength(1);
      expect(provider.validateBinding('stripe')).toBeNull();

      provider.addConfigPath({
        label: 'stripe.key',
        type: 'string',
        description: 'Stripe API key',
        category: 'config',
      });
      expect(provider.getConfigCompletions('stripe.')).toHaveLength(1);
    });
  });
});
