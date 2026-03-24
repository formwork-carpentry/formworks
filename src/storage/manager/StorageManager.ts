/**
 * @module @carpentry/storage
 * @description StorageManager — resolves storage disks by name, proxies to default disk.
 * Extends {@link BaseManager} for shared driver registration, lazy resolution, and instance caching.
 *
 * @patterns Abstract Factory (disk resolution), Strategy (disk drivers)
 * @principles DIP — app code uses IStorageAdapter; OCP — new drivers via registerDriver
 *             DRY — shared resolution logic via BaseManager
 */

import { CarpenterFactoryBase } from "@carpentry/formworks/adapters";
import type {
  IStorageAdapter,
  StorageFile,
  StorageFileMetadata,
  StoragePutOptions,
} from "@carpentry/formworks/contracts";
import { MemoryStorageAdapter } from "../adapters/MemoryStorageAdapter.js";
import { StorageNotInitializedError } from "../exceptions/base.js";

export interface StorageDiskConfig {
  driver: string;
  [key: string]: unknown;
}

export type StorageDiskFactory = (config: StorageDiskConfig) => IStorageAdapter;

/**
 * Resolve configured storage disks and proxy calls to the selected disk.
 *
 * StorageManager implements `IStorageAdapter` itself by delegating all methods to
 * a "default" disk (via {@link disk()}).
 *
 * Typical usage:
 * 1. Configure a StorageManager with a default disk
 * 2. Optionally register extra drivers with {@link registerDriver}
 * 3. Use the {@link Storage} facade after calling {@link setStorageManager}
 *
 * @example
 * ```ts
 * const manager = new StorageManager('local', {
 *   local: { driver: 'local', root: 'storage/app/public' },
 * });
 *
 * setStorageManager(manager);
 *
 * const path = 'avatars/1.png';
 * await Storage.put(path, Buffer.from('...'), { contentType: 'image/png' });
 * const publicUrl = Storage.url(path);
 * ```
 *
 * @see Storage — Global facade wrapper
 * @see IStorageAdapter — Storage disk contract
 * @see BaseManager — shared driver registration and resolution
 */
export class StorageManager
  extends CarpenterFactoryBase<IStorageAdapter, StorageDiskConfig>
  implements IStorageAdapter
{
  protected readonly resolverLabel = "disk";
  protected readonly domainLabel = "Storage";

  constructor(defaultDisk = "memory", configs: Record<string, StorageDiskConfig> = {}) {
    super(defaultDisk, configs);
    this.registerDriver("memory", (cfg) => new MemoryStorageAdapter(cfg.baseUrl as string));
  }

  /**
   * @param {string} [name]
   * @returns {IStorageAdapter}
   */
  disk(name?: string): IStorageAdapter {
    return this.resolve(name);
  }

  // ── Proxy to default disk ───────────────────────────────

  /**
   * @param {string} path
   * @returns {Promise<Buffer | null>}
   */
  async get(path: string): Promise<Buffer | null> {
    return this.disk().get(path);
  }
  /**
   * @param {string} path
   * @param {Buffer | string} content
   * @param {StoragePutOptions | string} [opts]
   * @returns {Promise<string>}
   */
  async put(
    path: string,
    content: Buffer | string,
    opts?: StoragePutOptions | string,
  ): Promise<string> {
    return this.disk().put(path, content, opts);
  }
  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async delete(path: string): Promise<boolean> {
    return this.disk().delete(path);
  }
  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async exists(path: string): Promise<boolean> {
    return this.disk().exists(path);
  }
  /**
   * @param {string} path
   * @returns {string}
   */
  url(path: string): string {
    return this.disk().url(path);
  }
  /**
   * @param {string} path
   * @param {number} sec
   * @returns {Promise<string>}
   */
  async temporaryUrl(path: string, sec: number): Promise<string> {
    return this.disk().temporaryUrl(path, sec);
  }
  /**
   * @param {string} from
   * @param {string} to
   * @returns {Promise<void>}
   */
  async copy(from: string, to: string): Promise<void> {
    return this.disk().copy(from, to);
  }
  /**
   * @param {string} from
   * @param {string} to
   * @returns {Promise<void>}
   */
  async move(from: string, to: string): Promise<void> {
    return this.disk().move(from, to);
  }
  /**
   * @param {string} [dir]
   * @returns {Promise<StorageFile[]>}
   */
  async list(dir?: string): Promise<StorageFile[]> {
    return this.disk().list(dir);
  }
  /**
   * @param {string} path
   * @returns {Promise<number>}
   */
  async size(path: string): Promise<number> {
    return this.disk().size(path);
  }
  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async mimeType(path: string): Promise<string> {
    return this.disk().mimeType(path);
  }
  /**
   * @param {string} path
   * @returns {Promise<Date>}
   */
  async lastModified(path: string): Promise<Date> {
    return this.disk().lastModified(path);
  }
  /**
   * @param {string} path
   * @returns {Promise<StorageFileMetadata | null>}
   */
  async metadata(path: string): Promise<StorageFileMetadata | null> {
    return this.disk().metadata(path);
  }
}

// ── Facade ────────────────────────────────────────────────

let globalStorageManager: StorageManager | null = null;

/**
 * @param {StorageManager} m
 */
export function setStorageManager(m: StorageManager): void {
  globalStorageManager = m;
}

export const Storage = {
  put: (path: string, content: Buffer | string, opts?: StoragePutOptions | string) =>
    getManager().put(path, content, opts),
  get: (path: string) => getManager().get(path),
  delete: (path: string) => getManager().delete(path),
  exists: (path: string) => getManager().exists(path),
  url: (path: string) => getManager().url(path),
  temporaryUrl: (path: string, expiresInSeconds: number) =>
    getManager().temporaryUrl(path, expiresInSeconds),
  disk: (name?: string) => getManager().disk(name),
  copy: (from: string, to: string) => getManager().copy(from, to),
  move: (from: string, to: string) => getManager().move(from, to),
  list: (directory?: string) => getManager().list(directory),
  metadata: (path: string) => getManager().metadata(path),
};

function getManager(): StorageManager {
  /**
   * @param {unknown} !globalStorageManager
   */
  if (!globalStorageManager) throw new StorageNotInitializedError();
  return globalStorageManager;
}
