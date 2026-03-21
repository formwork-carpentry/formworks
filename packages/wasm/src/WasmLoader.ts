/**
 * @module @formwork/wasm
 * @description WasmLoader — loads and instantiates WebAssembly modules with type-safe bindings.
 *
 * WHY: WASM modules can accelerate hot-path computations (image processing,
 * cryptography, serialization) by 10-100x over pure JS. WasmLoader provides
 * a consistent API for loading .wasm files across Node.js, Deno, and browsers.
 *
 * HOW: Provide a source (Buffer, URL, or file path) and optional import object.
 * WasmLoader handles compilation, instantiation, and memory management.
 *
 * @patterns Factory (creates module instances), Adapter (normalizes WASM loading across runtimes)
 * @principles SRP (WASM loading only), DIP (depends on WebAssembly API interface)
 *
 * @example
 * ```ts
 * // Load from a file path (Node.js)
 * const module = await WasmLoader.fromFile('./lib/image-resize.wasm');
 *
 * // Load from bytes
 * const module = await WasmLoader.fromBytes(wasmBuffer);
 *
 * // Call exported functions
 * const result = module.call('add', 40, 2); // 42
 *
 * // Access exports directly
 * const exports = module.getExports();
 * ```
 */

/** Configuration for WASM module loading */
export type WasmBinary = ArrayBuffer | ArrayBufferView;

export interface WasmMemoryLike {
  readonly buffer: ArrayBufferLike;
  grow(delta: number): number;
}

export interface WasmInstanceLike {
  readonly exports: Record<string, unknown>;
}

export interface WasmCompiledModuleLike {
  readonly __carpenterWasmModuleBrand?: true;
}

export interface WasmNamespaceLike {
  readonly Memory: new (descriptor: { initial: number; maximum?: number }) => WasmMemoryLike;
  compile(bytes: WasmBinary): Promise<WasmCompiledModuleLike>;
  instantiate(
    module: WasmCompiledModuleLike,
    imports?: Record<string, Record<string, unknown>>,
  ): Promise<WasmInstanceLike>;
  validate(bytes: WasmBinary): boolean;
}

export interface WasmLoaderConfig {
  /** Import object passed to WebAssembly.instantiate — host functions the WASM module can call */
  imports?: Record<string, Record<string, unknown>>;
  /** Maximum memory pages (64KB each) to allocate (default: 256 = 16MB) */
  maxMemoryPages?: number;
  /** Enable WASI (WebAssembly System Interface) compatibility layer */
  wasi?: boolean;
}

/** A loaded and instantiated WASM module with a friendly API */
export interface WasmModule {
  /** The raw WebAssembly.Instance for advanced use */
  instance: WasmInstanceLike;
  /** The raw WebAssembly.Module for re-instantiation */
  module: WasmCompiledModuleLike;
  /** Call an exported function by name with type-safe return */
  /**
   * @param {string} functionName
   * @param {unknown[]} ...args
   * @returns {T}
   */
  call<T = unknown>(functionName: string, ...args: unknown[]): T;
  /** Get all exported functions and values */
  getExports(): Record<string, unknown>;
  /** Get the module's linear memory (for direct buffer access) */
  getMemory(): WasmMemoryLike | null;
  /** Get exported function names */
  getExportedFunctions(): string[];
}

/**
 * WasmLoader — factory for loading WebAssembly modules.
 *
 * @example
 * ```ts
 * // From raw bytes (works everywhere)
 * const wasm = await WasmLoader.fromBytes(buffer, {
 *   imports: {
 *     env: {
 *       log: (ptr: number, len: number) => console.log('WASM log:', ptr, len),
 *     },
 *   },
 * });
 *
 * // From a file (Node.js / Deno)
 * const wasm = await WasmLoader.fromFile('./optimized.wasm');
 * const result = wasm.call<number>('fibonacci', 10); // 55
 * ```
 */
// biome-ignore lint/complexity/noStaticOnlyClass: WasmLoader is a static factory/utility class for WASM module initialization
export class WasmLoader {
  /**
   * Load a WASM module from raw bytes (Buffer or Uint8Array).
   * Works in all runtimes (Node.js, Deno, browsers).
   */
  static async fromBytes(bytes: WasmBinary, config: WasmLoaderConfig = {}): Promise<WasmModule> {
    const webAssembly = WasmLoader.getWebAssemblyNamespace();
    const imports = { ...(config.imports ?? {}) };

    // Add default memory if not provided and module might need it
    if (!imports.env?.memory) {
      const maxPages = config.maxMemoryPages ?? 256;
      const memory = new webAssembly.Memory({ initial: 1, maximum: maxPages });
      imports.env = { ...(imports.env ?? {}), memory };
    }

    // Compile and instantiate
    const module = await webAssembly.compile(bytes);
    const instance = await webAssembly.instantiate(module, imports);

    return WasmLoader.wrapInstance(module, instance);
  }

  /**
   * Load a WASM module from a file path.
   * Node.js: uses fs.readFile. Deno: uses Deno.readFile.
   */
  static async fromFile(path: string, config: WasmLoaderConfig = {}): Promise<WasmModule> {
    // Dynamic import to avoid bundler issues in non-Node environments
    const fs = await import("node:fs/promises");
    const bytes = await fs.readFile(path);
    return WasmLoader.fromBytes(bytes, config);
  }

  /**
   * Load a WASM module from a URL (fetch-based).
   * Works in browsers and edge runtimes.
   */
  static async fromUrl(url: string, config: WasmLoaderConfig = {}): Promise<WasmModule> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM module from ${url}: ${response.status}`);
    }
    const bytes = await response.arrayBuffer();
    return WasmLoader.fromBytes(bytes, config);
  }

  /**
   * Validate a WASM binary without instantiating it.
   * Returns true if the bytes represent a valid WASM module.
   */
  static async validate(bytes: WasmBinary): Promise<boolean> {
    try {
      return WasmLoader.getWebAssemblyNamespace().validate(bytes);
    } catch {
      return false;
    }
  }

  /** Wrap a raw WebAssembly.Instance into our friendly WasmModule API */
  private static wrapInstance(
    module: WasmCompiledModuleLike,
    instance: WasmInstanceLike,
  ): WasmModule {
    return {
      instance,
      module,

      call<T = unknown>(functionName: string, ...args: unknown[]): T {
        const fn = instance.exports[functionName];
        if (typeof fn !== "function") {
          throw new Error(
            `WASM export "${functionName}" is not a function. ` +
              `Available functions: ${Object.keys(instance.exports)
                .filter((k) => typeof instance.exports[k] === "function")
                .join(", ")}`,
          );
        }
        return (fn as (...a: unknown[]) => T)(...args);
      },

      getExports(): Record<string, unknown> {
        return { ...instance.exports };
      },

      getMemory(): WasmMemoryLike | null {
        // Look for memory export (commonly named 'memory')
        const mem = instance.exports.memory;
        if (WasmLoader.isWasmMemoryLike(mem)) return mem;
        return null;
      },

      getExportedFunctions(): string[] {
        return Object.keys(instance.exports).filter(
          (k) => typeof instance.exports[k] === "function",
        );
      },
    };
  }

  private static getWebAssemblyNamespace(): WasmNamespaceLike {
    const webAssembly = (globalThis as Record<string, unknown>).WebAssembly;
    if (!webAssembly) {
      throw new Error("WebAssembly runtime is not available in this environment.");
    }
    return webAssembly as WasmNamespaceLike;
  }

  private static isWasmMemoryLike(value: unknown): value is WasmMemoryLike {
    return (
      typeof value === "object" &&
      value !== null &&
      "buffer" in value &&
      "grow" in value &&
      typeof (value as { grow: unknown }).grow === "function"
    );
  }
}
