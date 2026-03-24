import { describe, it, expect } from 'vitest';
import { WasmLoader } from '../src/WasmLoader.js';

const ADD_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d,
  0x01, 0x00, 0x00, 0x00,
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
]);

describe('wasm/WasmLoader', () => {
  describe('fromBytes', () => {
    it('loads and instantiates a wasm module', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      expect(mod.instance).toBeDefined();
      expect(mod.module).toBeDefined();
    });

    it('calls exported functions and lists exports', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      expect(mod.call<number>('add', 40, 2)).toBe(42);
      expect(mod.getExportedFunctions()).toContain('add');
      expect(mod.getExports()).toHaveProperty('add');
    });

    it('throws for unknown function calls', async () => {
      const mod = await WasmLoader.fromBytes(ADD_WASM);
      expect(() => mod.call('nonexistent')).toThrow('not a function');
    });
  });

  describe('validate', () => {
    it('validates known good bytes and rejects invalid bytes', async () => {
      expect(await WasmLoader.validate(ADD_WASM)).toBe(true);
      expect(await WasmLoader.validate(new Uint8Array([0, 1, 2, 3]))).toBe(false);
    });
  });
});
