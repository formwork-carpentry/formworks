/**
 * @module tests
 * @description Tests for WasmLoader, GraphQL Federation decorators, and PluginManager
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

// ── WASM ──────────────────────────────────────────────────

import { WasmLoader } from '../packages/wasm/src/WasmLoader.js';

// Minimal valid WASM module that exports an `add` function: (i32, i32) -> i32
// Generated from: (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
const ADD_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, // magic: \0asm
  0x01, 0x00, 0x00, 0x00, // version: 1
  // Type section: one function type (i32, i32) -> i32
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  // Function section: one function using type 0
  0x03, 0x02, 0x01, 0x00,
  // Export section: export "add" as function 0
  0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
  // Code section: function body
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
]);

describe('WasmLoader', () => {
  describe('fromBytes', () => {
    it('loads and instantiates a WASM module', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      expect(mod.instance).toBeDefined();
      expect(mod.module).toBeDefined();
    });

    it('calls exported functions', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      const result = mod.call<number>('add', 40, 2);
      expect(result).toBe(42);
    });

    it('lists exported functions', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      expect(mod.getExportedFunctions()).toContain('add');
    });

    it('getExports returns all exports', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      expect(mod.getExports()).toHaveProperty('add');
    });

    it('throws for non-existent function', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      expect(() => mod.call('nonexistent')).toThrow('not a function');
    });
  });

  describe('validate', () => {
    it('returns true for valid WASM', async () => {
      expect(await WasmLoader.validate(ADD_WASM)).toBe(true);
    });

    it('returns false for invalid bytes', async () => {
      expect(await WasmLoader.validate(new Uint8Array([0, 1, 2, 3]))).toBe(false);
    });
  });
});

// ── GRAPHQL FEDERATION ────────────────────────────────────

import {
  FederationKey, External, Provides, Requires,
  getFederationKeys, isExternalField, getProvides, getRequires,
  clearFederationRegistries, buildFederatedSchema,
} from '../packages/graphql/src/federation.js';
import { ObjectType, Field, Resolver, Query, clearRegistries } from '../packages/graphql/src/decorators.js';

describe('GraphQL Federation', () => {
  beforeEach(() => {
    clearRegistries();
    clearFederationRegistries();
  });

  describe('@FederationKey', () => {
    it('registers a key for a type', () => {
      class User { id!: string; }
      FederationKey('id')(User);
      expect(getFederationKeys(User)).toEqual(['id']);
    });

    it('supports composite keys', () => {
      class Product { id!: string; sku!: string; }
      FederationKey('id sku')(Product);
      expect(getFederationKeys(Product)).toEqual(['id sku']);
    });

    it('supports multiple @key directives', () => {
      class Product { id!: string; sku!: string; }
      FederationKey('id')(Product);
      FederationKey('sku')(Product);
      expect(getFederationKeys(Product)).toEqual(['id', 'sku']);
    });
  });

  describe('@External', () => {
    it('marks a field as externally resolved', () => {
      class Review { author!: unknown; }
      External()(Review.prototype, 'author');
      expect(isExternalField(Review, 'author')).toBe(true);
      expect(isExternalField(Review, 'body')).toBe(false);
    });
  });

  describe('@Provides', () => {
    it('declares fields this subgraph provides', () => {
      class Review { author!: unknown; }
      Provides('name email')(Review.prototype, 'author');
      expect(getProvides(Review, 'author')).toBe('name email');
    });
  });

  describe('@Requires', () => {
    it('declares fields required from parent entity', () => {
      class Product { shippingCost!: number; }
      Requires('price weight')(Product.prototype, 'shippingCost');
      expect(getRequires(Product, 'shippingCost')).toBe('price weight');
    });
  });

  describe('buildFederatedSchema', () => {
    it('generates SDL with @key directives', () => {
      class User { id!: string; name!: string; }
      ObjectType()(User);
      Field('ID')(User.prototype, 'id');
      Field('String')(User.prototype, 'name');
      FederationKey('id')(User);

      const sdl = buildFederatedSchema([User], []);
      expect(sdl).toContain('extend schema @link');
      expect(sdl).toContain('type User @key(fields: "id")');
      expect(sdl).toContain('id: ID!');
      expect(sdl).toContain('name: String!');
    });

    it('includes @external directive on fields', () => {
      class Review { id!: string; author!: unknown; }
      ObjectType()(Review);
      Field('ID')(Review.prototype, 'id');
      Field('User')(Review.prototype, 'author');
      FederationKey('id')(Review);
      External()(Review.prototype, 'author');

      const sdl = buildFederatedSchema([Review], []);
      expect(sdl).toContain('author: User! @external');
    });

    it('includes @provides directive on fields', () => {
      class Review { id!: string; author!: unknown; }
      ObjectType()(Review);
      Field('ID')(Review.prototype, 'id');
      Field('User')(Review.prototype, 'author');
      FederationKey('id')(Review);
      Provides('name')(Review.prototype, 'author');

      const sdl = buildFederatedSchema([Review], []);
      expect(sdl).toContain('@provides(fields: "name")');
    });
  });
});

// ── PLUGIN MANAGER ────────────────────────────────────────

import { PluginManager } from '@carpentry/core/plugin';
import type { CarpenterPlugin } from '@carpentry/core/plugin';
import { Container } from '@carpentry/core/container';

describe('PluginManager', () => {
  let manager: PluginManager;
  let container: Container;

  beforeEach(() => {
    manager = new PluginManager();
    container = new Container();
  });

  function mockPlugin(name: string, deps: string[] = []): CarpenterPlugin {
    return { name, version: '1.0.0', dependencies: deps };
  }

  describe('add', () => {
    it('registers a plugin', () => {
      manager.add(mockPlugin('auth'));
      expect(manager.has('auth')).toBe(true);
      expect(manager.count()).toBe(1);
    });

    it('throws on duplicate', () => {
      manager.add(mockPlugin('auth'));
      expect(() => manager.add(mockPlugin('auth'))).toThrow('already registered');
    });
  });

  describe('enable/disable', () => {
    it('disables a plugin', () => {
      manager.add(mockPlugin('auth'));
      manager.disable('auth');
      expect(manager.get('auth')!.enabled).toBe(false);
      expect(manager.getEnabledNames()).not.toContain('auth');
    });

    it('re-enables a disabled plugin', () => {
      manager.add(mockPlugin('auth'));
      manager.disable('auth');
      manager.enable('auth');
      expect(manager.get('auth')!.enabled).toBe(true);
    });
  });

  describe('registerAll', () => {
    it('calls register() on all enabled plugins', () => {
      const registered: string[] = [];
      const plugin: CarpenterPlugin = {
        name: 'test', version: '1.0.0',
        register: () => registered.push('test'),
      };
      manager.add(plugin);
      manager.registerAll(container);
      expect(registered).toEqual(['test']);
      expect(manager.get('test')!.registered).toBe(true);
    });

    it('skips disabled plugins', () => {
      const registered: string[] = [];
      manager.add({ name: 'a', version: '1.0.0', register: () => registered.push('a') });
      manager.add({ name: 'b', version: '1.0.0', register: () => registered.push('b') });
      manager.disable('b');
      manager.registerAll(container);
      expect(registered).toEqual(['a']);
    });

    it('validates dependencies before registering', () => {
      manager.add(mockPlugin('stripe', ['billing']));
      expect(() => manager.registerAll(container)).toThrow('billing');
    });

    it('passes if dependencies are satisfied', () => {
      manager.add(mockPlugin('billing'));
      manager.add(mockPlugin('stripe', ['billing']));
      manager.registerAll(container); // Should not throw
    });
  });

  describe('bootAll', () => {
    it('calls boot() on all registered plugins', async () => {
      const booted: string[] = [];
      manager.add({ name: 'a', version: '1.0.0', register: () => {}, boot: () => { booted.push('a'); } });
      manager.add({ name: 'b', version: '1.0.0', register: () => {}, boot: () => { booted.push('b'); } });
      manager.registerAll(container);
      await manager.bootAll(container);
      expect(booted).toEqual(['a', 'b']);
    });

    it('supports async boot', async () => {
      let result = '';
      manager.add({
        name: 'async-plugin', version: '1.0.0',
        register: () => {},
        boot: async () => {
          await new Promise((r) => setTimeout(r, 5));
          result = 'booted';
        },
      });
      manager.registerAll(container);
      await manager.bootAll(container);
      expect(result).toBe('booted');
    });
  });

  describe('shutdownAll', () => {
    it('calls shutdown() in reverse order', async () => {
      const order: string[] = [];
      manager.add({ name: 'a', version: '1.0.0', register: () => {}, boot: () => {}, shutdown: () => { order.push('a'); } });
      manager.add({ name: 'b', version: '1.0.0', register: () => {}, boot: () => {}, shutdown: () => { order.push('b'); } });
      manager.registerAll(container);
      await manager.bootAll(container);
      await manager.shutdownAll();
      expect(order).toEqual(['b', 'a']); // Reverse of registration order
    });
  });

  describe('getConfigDefaults', () => {
    it('merges config from all enabled plugins', () => {
      manager.add({
        name: 'a', version: '1.0.0',
        configDefaults: () => ({ auth: { driver: 'jwt' } }),
      });
      manager.add({
        name: 'b', version: '1.0.0',
        configDefaults: () => ({ billing: { currency: 'USD' } }),
      });
      const defaults = manager.getConfigDefaults();
      expect(defaults).toEqual({ auth: { driver: 'jwt' }, billing: { currency: 'USD' } });
    });
  });

  describe('getNames / getEnabledNames', () => {
    it('returns plugin names', () => {
      manager.add(mockPlugin('a'));
      manager.add(mockPlugin('b'));
      manager.add(mockPlugin('c'));
      manager.disable('b');
      expect(manager.getNames()).toEqual(['a', 'b', 'c']);
      expect(manager.getEnabledNames()).toEqual(['a', 'c']);
    });
  });
});
