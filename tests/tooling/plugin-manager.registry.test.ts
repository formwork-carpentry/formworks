import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from '@carpentry/formworks/tooling';
import type { CarpenterPlugin } from '@carpentry/formworks/tooling';
import { Container } from '@carpentry/core/container';

describe('tooling/PluginManager registry', () => {
  let manager: PluginManager;
  let container: Container;

  beforeEach(() => {
    manager = new PluginManager();
    container = new Container();
  });

  function mockPlugin(name: string, deps: string[] = []): CarpenterPlugin {
    return { name, version: '1.0.0', dependencies: deps };
  }

  describe('registration and toggling', () => {
    it('registers plugins and prevents duplicates', () => {
      manager.add(mockPlugin('auth'));
      expect(manager.has('auth')).toBe(true);
      expect(manager.count()).toBe(1);
      expect(() => manager.add(mockPlugin('auth'))).toThrow('already registered');
    });

    it('enables and disables plugins', () => {
      manager.add(mockPlugin('auth'));
      manager.disable('auth');
      expect(manager.get('auth')!.enabled).toBe(false);
      expect(manager.getEnabledNames()).not.toContain('auth');

      manager.enable('auth');
      expect(manager.get('auth')!.enabled).toBe(true);
    });
  });

  describe('registerAll and dependencies', () => {
    it('registers enabled plugins and skips disabled ones', () => {
      const registered: string[] = [];
      manager.add({ name: 'a', version: '1.0.0', register: () => registered.push('a') });
      manager.add({ name: 'b', version: '1.0.0', register: () => registered.push('b') });
      manager.disable('b');

      manager.registerAll(container);
      expect(registered).toEqual(['a']);
      expect(manager.get('a')!.registered).toBe(true);
    });

    it('validates dependencies', () => {
      manager.add(mockPlugin('stripe', ['billing']));
      expect(() => manager.registerAll(container)).toThrow('billing');

      const ok = new PluginManager();
      ok.add(mockPlugin('billing'));
      ok.add(mockPlugin('stripe', ['billing']));
      expect(() => ok.registerAll(container)).not.toThrow();
    });
  });

  describe('metadata and defaults', () => {
    it('returns names and enabled names', () => {
      manager.add(mockPlugin('a'));
      manager.add(mockPlugin('b'));
      manager.add(mockPlugin('c'));
      manager.disable('b');

      expect(manager.getNames()).toEqual(['a', 'b', 'c']);
      expect(manager.getEnabledNames()).toEqual(['a', 'c']);
    });

    it('merges plugin config defaults', () => {
      manager.add({ name: 'a', version: '1.0.0', configDefaults: () => ({ auth: { driver: 'jwt' } }) });
      manager.add({ name: 'b', version: '1.0.0', configDefaults: () => ({ billing: { currency: 'USD' } }) });

      expect(manager.getConfigDefaults()).toEqual({ auth: { driver: 'jwt' }, billing: { currency: 'USD' } });
    });
  });
});
