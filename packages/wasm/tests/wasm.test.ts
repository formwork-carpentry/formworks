import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryWasmModule, InMemoryWasmLoader, WasmManager } from '../src/index.js';

describe('@formwork/wasm: InMemoryWasmModule', () => {
  let mod: InMemoryWasmModule;

  beforeEach(() => {
    mod = new InMemoryWasmModule('math', {
      add: (a: unknown, b: unknown) => (a as number) + (b as number),
      multiply: (a: unknown, b: unknown) => (a as number) * (b as number),
      greet: (name: unknown) => `Hello, ${name}!`,
    });
  });

  it('call() invokes exported function', () => {
    expect(mod.call<number>('add', 3, 4)).toBe(7);
    expect(mod.call<number>('multiply', 5, 6)).toBe(30);
    expect(mod.call<string>('greet', 'World')).toBe('Hello, World!');
  });

  it('call() throws for missing export', () => {
    expect(() => mod.call('nonexistent')).toThrow('not found');
  });

  it('hasExport()', () => {
    expect(mod.hasExport('add')).toBe(true);
    expect(mod.hasExport('nope')).toBe(false);
  });

  it('tracks call log', () => {
    mod.call('add', 1, 2);
    mod.call('multiply', 3, 4);

    mod.assertCalled('add');
    mod.assertCalled('multiply');
    mod.assertCalledWith('add', 1, 2);
    expect(mod.getCallLog()).toHaveLength(2);
  });

  it('assertCalled throws on miss', () => {
    expect(() => mod.assertCalled('nope')).toThrow();
  });

  it('reset() clears call log', () => {
    mod.call('add', 1, 2);
    mod.reset();
    expect(mod.getCallLog()).toHaveLength(0);
  });
});

describe('@formwork/wasm: InMemoryWasmLoader', () => {
  it('loads registered modules', async () => {
    const loader = new InMemoryWasmLoader();
    loader.register('math', { add: (a: unknown, b: unknown) => (a as number) + (b as number) });

    const mod = await loader.load('math', new Uint8Array());
    expect(mod.name).toBe('math');
    expect(mod.call<number>('add', 2, 3)).toBe(5);
  });

  it('throws for unregistered module', async () => {
    const loader = new InMemoryWasmLoader();
    await expect(loader.load('unknown', new Uint8Array())).rejects.toThrow('not registered');
  });
});

describe('@formwork/wasm: WasmManager', () => {
  let loader: InMemoryWasmLoader;
  let manager: WasmManager;

  beforeEach(() => {
    loader = new InMemoryWasmLoader();
    loader.register('math', {
      add: (a: unknown, b: unknown) => (a as number) + (b as number),
      fib: (n: unknown) => {
        const num = n as number;
        if (num <= 1) return num;
        let a = 0, b = 1;
        for (let i = 2; i <= num; i++) { [a, b] = [b, a + b]; }
        return b;
      },
    });
    manager = new WasmManager(loader);
  });

  it('load() loads and caches module', async () => {
    const mod = await manager.load('math', new Uint8Array());
    expect(mod.name).toBe('math');
    expect(manager.has('math')).toBe(true);

    // Second load returns cached
    const mod2 = await manager.load('math', new Uint8Array());
    expect(mod2).toBe(mod);
  });

  it('get() returns loaded module', async () => {
    expect(manager.get('math')).toBeNull();
    await manager.load('math', new Uint8Array());
    expect(manager.get('math')).not.toBeNull();
  });

  it('unload() removes module', async () => {
    await manager.load('math', new Uint8Array());
    expect(manager.unload('math')).toBe(true);
    expect(manager.has('math')).toBe(false);
  });

  it('modules() lists loaded modules', async () => {
    await manager.load('math', new Uint8Array());
    expect(manager.modules()).toEqual(['math']);
  });

  it('calling functions through manager', async () => {
    const mod = await manager.load('math', new Uint8Array());
    expect(mod.call<number>('add', 10, 20)).toBe(30);
    expect(mod.call<number>('fib', 10)).toBe(55);
  });
});
