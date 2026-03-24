/**
 * @module @carpentry/storage
 * @description Storage manager with pluggable disk adapters (in-memory, local, S3, etc.).
 *
 * Use this package to:
 * - Persist binary content with a named disk abstraction
 * - Resolve disks lazily by configuration (`StorageManager.disk()`)
 * - Use a global facade (`Storage`) for app-friendly helpers
 *
 * @example
 * ```ts
 * import { StorageManager, setStorageManager, Storage } from './';
 *
 * const manager = new StorageManager('local', {
 *   local: { driver: 'local', root: 'storage/app/public' },
 * });
 *
 * setStorageManager(manager);
 * await Storage.put('uploads/hello.txt', 'Hello!');
 * const url = Storage.url('uploads/hello.txt');
 * ```
 *
 * @see StorageManager — Resolve disks and proxy I/O calls
 * @see Storage — Global facade for the configured manager
 * @see LocalStorageAdapter — Local filesystem disk implementation
 */

export { MemoryStorageAdapter } from "./adapters/MemoryStorageAdapter.js";
export { LocalStorageAdapter } from "./adapters/LocalStorageAdapter.js";
export type { LocalStorageConfig } from "./adapters/LocalStorageAdapter.js";
export {
  StorageManager,
  setStorageManager,
  Storage,
  createStorageManager,
} from "./manager/index.js";
export type { StorageDiskFactory } from "./manager/index.js";
export * from "./exceptions.js";
