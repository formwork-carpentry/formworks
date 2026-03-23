/**
 * @module @carpentry/core/contracts/wasm
 * @description WebAssembly contracts - module loading and execution.
 *
 * Implementations: WasmLoader, WasmManager, InMemoryWasmModule
 *
 * @example
 * ```ts
 * const module = await WasmLoader.fromBytes(wasmBytes);
 * const result = module.call<number>('add', 40, 2); // 42
 * ```
 */

export type WasmBinary = ArrayBuffer | ArrayBufferView;

export interface WasmMemoryLike {
  readonly buffer: ArrayBufferLike;
  grow(delta: number): number;
}

/** @typedef {Object} IWasmModule - A loaded WebAssembly module */
export interface IWasmModule {
  /**
   * Call an exported function by name.
   * @param {string} functionName - Exported function name
   * @param {...unknown} args - Function arguments
   * @returns {T} Function return value
   * @throws {Error} If function does not exist
   * @example
   * ```ts
   * const sum = module.call<number>('add', 40, 2); // 42
   * ```
   */
  call<T = unknown>(functionName: string, ...args: unknown[]): T;

  /**
   * Get all exported functions and values.
   * @returns {Record<string, unknown>}
   */
  getExports(): Record<string, unknown>;

  /**
   * Get the module's linear memory.
   * @returns {WasmMemoryLike | null}
   */
  getMemory(): WasmMemoryLike | null;

  /**
   * List exported function names.
   * @returns {string[]}
   */
  getExportedFunctions(): string[];
}

/** @typedef {Object} IWasmLoader - Factory for loading WASM modules */
export interface IWasmLoader {
  /**
   * Load a WASM module from raw bytes.
   * @param {WasmBinary} bytes - WASM binary
   * @param {Record<string, unknown>} [imports] - Host functions the module can call
   * @returns {Promise<IWasmModule>}
   */
  fromBytes(bytes: WasmBinary, imports?: Record<string, unknown>): Promise<IWasmModule>;

  /**
   * Validate WASM binary without instantiating.
   * @param {WasmBinary} bytes - WASM binary to validate
   * @returns {Promise<boolean>}
   */
  validate(bytes: WasmBinary): Promise<boolean>;
}
