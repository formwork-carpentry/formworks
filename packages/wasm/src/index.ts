/**
 * @module @formwork/wasm
 * @description WASM module loading and sandboxed execution
 * @patterns Strategy (loaders), Proxy (sandboxed calls), Factory (module instantiation)
 * @principles DIP — app depends on IWasmModule; OCP — new loaders via registerLoader
 *
 * Use this package to:
 * - Load and cache WASM modules via a {@link IWasmLoader}
 * - Call exported functions through a friendly {@link WasmModule} API
 * - Test WASM logic with {@link InMemoryWasmLoader}
 *
 * @example
 * ```ts
 * import { WasmManager, InMemoryWasmLoader } from '@formwork/wasm';
 *
 * const loader = new InMemoryWasmLoader().register('math', {
 *   add: (a: number, b: number) => a + b,
 * });
 *
 * const manager = new WasmManager(loader);
 * const mod = await manager.load('math', new Uint8Array());
 *
 * const sum = mod.call<number>('add', 1, 2); // 3
 * ```
 */

// ── Types ─────────────────────────────────────────────────

export interface WasmExports {
  [key: string]: (...args: unknown[]) => unknown;
}

export interface WasmModule {
  readonly name: string;
  readonly exports: WasmExports;
  /** Call an exported function */
  /**
   * @param {string} fn
   * @param {unknown[]} ...args
   * @returns {T}
   */
  call<T = unknown>(fn: string, ...args: unknown[]): T;
  /** Check if a function is exported */
  /**
   * @param {string} fn
   * @returns {boolean}
   */
  hasExport(fn: string): boolean;
  /** Get memory usage in bytes */
  memoryUsage(): number;
}

export interface WasmLoadOptions {
  /** Memory limit in pages (64KB each) */
  memoryPages?: number;
  /** Environment imports to inject */
  imports?: Record<string, Record<string, unknown>>;
  /** Sandbox level */
  sandbox?: "strict" | "permissive";
}

// ── InMemoryWasmModule — for testing ──────────────────────

/**
 * Test implementation of `WasmModule` with call logging (`assertCalled`, `getCallLog`).
 *
 * @example
 * ```ts
 * import { InMemoryWasmModule } from '@formwork/wasm';
 * const m = new InMemoryWasmModule('demo', { add: (a: number, b: number) => a + b });
 * m.call<number>('add', 2, 3);
 * ```
 */
export class InMemoryWasmModule implements WasmModule {
  readonly name: string;
  readonly exports: WasmExports;
  private callLog: Array<{ fn: string; args: unknown[]; result: unknown }> = [];

  constructor(name: string, exports: WasmExports) {
    this.name = name;
    this.exports = exports;
  }

  /**
   * @param {string} fn
   * @param {unknown[]} ...args
   * @returns {T}
   */
  call<T = unknown>(fn: string, ...args: unknown[]): T {
    const exportFn = this.exports[fn];
    if (!exportFn) throw new Error(`WASM export "${fn}" not found in module "${this.name}".`);
    const result = exportFn(...args);
    this.callLog.push({ fn, args, result });
    return result as T;
  }

  /**
   * @param {string} fn
   * @returns {boolean}
   */
  hasExport(fn: string): boolean {
    return fn in this.exports;
  }

  memoryUsage(): number {
    return 0;
  } // no real memory in mock

  getCallLog() {
    return [...this.callLog];
  }

  /**
   * @param {string} fn
   */
  assertCalled(fn: string): void {
    if (!this.callLog.some((c) => c.fn === fn)) {
      throw new Error(`Expected WASM function "${fn}" to be called, but it was not.`);
    }
  }

  /**
   * @param {string} fn
   * @param {unknown[]} ...expectedArgs
   */
  assertCalledWith(fn: string, ...expectedArgs: unknown[]): void {
    const match = this.callLog.find(
      (c) => c.fn === fn && JSON.stringify(c.args) === JSON.stringify(expectedArgs),
    );
    if (!match)
      throw new Error(
        `Expected "${fn}" called with ${JSON.stringify(expectedArgs)}, but no match found.`,
      );
  }

  reset(): void {
    this.callLog = [];
  }
}

// ── WasmLoader — loads and instantiates modules ───────────

export interface IWasmLoader {
  /**
   * @param {string} name
   * @param {Uint8Array | string} source
   * @param {WasmLoadOptions} [options]
   * @returns {Promise<WasmModule>}
   */
  load(name: string, source: Uint8Array | string, options?: WasmLoadOptions): Promise<WasmModule>;
}

/**
 * `IWasmLoader` that serves pre-registered export maps — pairs with `WasmManager` in tests.
 *
 * @example
 * ```ts
 * import { InMemoryWasmLoader, WasmManager } from '@formwork/wasm';
 * const loader = new InMemoryWasmLoader().register('math', { double: (n: number) => n * 2 });
 * const mod = await new WasmManager(loader).load('math', new Uint8Array());
 * ```
 */
export class InMemoryWasmLoader implements IWasmLoader {
  private modules = new Map<string, WasmExports>();

  /** Register a mock WASM module */
  /**
   * @param {string} name
   * @param {WasmExports} exports
   * @returns {this}
   */
  register(name: string, exports: WasmExports): this {
    this.modules.set(name, exports);
    return this;
  }

  /**
   * @param {string} name
   * @returns {Promise<WasmModule>}
   */
  async load(
    name: string,
    _source: Uint8Array | string,
    _options?: WasmLoadOptions,
  ): Promise<WasmModule> {
    const exports = this.modules.get(name);
    if (!exports) throw new Error(`WASM module "${name}" not registered in InMemoryWasmLoader.`);
    return new InMemoryWasmModule(name, exports);
  }

  reset(): void {
    this.modules.clear();
  }
}

// ── WasmManager — registry + loader ───────────────────────

/**
 * Caches loaded `WasmModule` instances behind an `IWasmLoader` (production or `InMemoryWasmLoader`).
 *
 * @example
 * ```ts
 * import { WasmManager, InMemoryWasmLoader } from '@formwork/wasm';
 * const mgr = new WasmManager(new InMemoryWasmLoader().register('x', {}));
 * await mgr.load('x', new Uint8Array());
 * ```
 */
export class WasmManager {
  private loaded = new Map<string, WasmModule>();
  private loader: IWasmLoader;

  constructor(loader: IWasmLoader) {
    this.loader = loader;
  }

  /** Load and cache a WASM module */
  /**
   * @param {string} name
   * @param {Uint8Array | string} source
   * @param {WasmLoadOptions} [options]
   * @returns {Promise<WasmModule>}
   */
  async load(
    name: string,
    source: Uint8Array | string,
    options?: WasmLoadOptions,
  ): Promise<WasmModule> {
    const cached = this.loaded.get(name);
    if (cached) return cached;
    const module = await this.loader.load(name, source, options);
    this.loaded.set(name, module);
    return module;
  }

  /** Get an already-loaded module */
  /**
   * @param {string} name
   * @returns {WasmModule | null}
   */
  get(name: string): WasmModule | null {
    return this.loaded.get(name) ?? null;
  }

  /** Check if a module is loaded */
  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name: string): boolean {
    return this.loaded.has(name);
  }

  /** Unload a module */
  /**
   * @param {string} name
   * @returns {boolean}
   */
  unload(name: string): boolean {
    return this.loaded.delete(name);
  }

  /** Get all loaded module names */
  modules(): string[] {
    return [...this.loaded.keys()];
  }

  reset(): void {
    this.loaded.clear();
  }
}
