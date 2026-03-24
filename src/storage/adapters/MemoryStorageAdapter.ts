/**
 * @module @carpentry/storage
 * @description In-memory storage adapter — stores files in a Map for testing
 * @patterns Adapter (implements IStorageAdapter), Null Object variant
 * @principles LSP — substitutable for Local/S3/GCS adapters
 */

import type {
  IStorageAdapter,
  StorageFile,
  StorageFileMetadata,
  StoragePutOptions,
} from "@carpentry/formworks/contracts";
import { StorageFileNotFoundError } from "../exceptions/base.js";

interface StoredFile {
  content: Buffer;
  visibility: "public" | "private";
  contentType: string;
  lastModified: Date;
}

/**
 * MemoryStorageAdapter — in-memory storage adapter.
 *
 * This is intended for tests/dev. Files are stored in a `Map` and never touch disk.
 * It supports the full `IStorageAdapter` API and exposes additional helpers
 * for assertions (`fileCount()`, `assertExists()`, `assertMissing()`, `assertContent()`).
 *
 * @example
 * ```ts
 * const storage = new MemoryStorageAdapter('https://storage.test');
 *
 * await storage.put('avatars/user-1.png', Buffer.from('PNG_BYTES'));
 * const buf = await storage.get('avatars/user-1.png');
 * // buf is a Buffer with stored content
 *
 * storage.assertExists('avatars/user-1.png');
 * expect(storage.fileCount()).toBeGreaterThan(0);
 * ```
 */
export class MemoryStorageAdapter implements IStorageAdapter {
  private files = new Map<string, StoredFile>();
  private baseUrl: string;

  constructor(baseUrl = "https://storage.test") {
    this.baseUrl = baseUrl;
  }

  /**
   * @param {string} path
   * @returns {Promise<Buffer | null>}
   */
  async get(path: string): Promise<Buffer | null> {
    const file = this.files.get(this.normalizePath(path));
    return file ? file.content : null;
  }

  /**
   * @param {string} path
   * @param {Buffer | string} content
   * @param {StoragePutOptions | string} [options]
   * @returns {Promise<string>}
   */
  async put(
    path: string,
    content: Buffer | string,
    options?: StoragePutOptions | string,
  ): Promise<string> {
    const normalized = this.normalizePath(path);
    const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    const resolvedOptions = typeof options === "string" ? { contentType: options } : options;
    this.files.set(normalized, {
      content: buf,
      visibility: resolvedOptions?.visibility ?? "private",
      contentType: resolvedOptions?.contentType ?? "application/octet-stream",
      lastModified: new Date(),
    });
    return normalized;
  }

  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async delete(path: string): Promise<boolean> {
    return this.files.delete(this.normalizePath(path));
  }

  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async exists(path: string): Promise<boolean> {
    return this.files.has(this.normalizePath(path));
  }

  /**
   * @param {string} path
   * @returns {string}
   */
  url(path: string): string {
    return `${this.baseUrl}/${this.normalizePath(path)}`;
  }

  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async temporaryUrl(path: string, _expiresInSeconds: number): Promise<string> {
    return `${this.url(path)}?token=mock-temp-token&expires=${Date.now()}`;
  }

  /**
   * @param {string} from
   * @param {string} to
   * @returns {Promise<void>}
   */
  async copy(from: string, to: string): Promise<void> {
    const file = this.files.get(this.normalizePath(from));
    if (!file) throw new StorageFileNotFoundError(from);
    this.files.set(this.normalizePath(to), { ...file, content: Buffer.from(file.content) });
  }

  /**
   * @param {string} from
   * @param {string} to
   * @returns {Promise<void>}
   */
  async move(from: string, to: string): Promise<void> {
    await this.copy(from, to);
    await this.delete(from);
  }

  /**
   * @param {string} [directory]
   * @returns {Promise<StorageFile[]>}
   */
  async list(directory?: string): Promise<StorageFile[]> {
    const prefix = directory ? `${this.normalizePath(directory)}/` : "";
    const result: StorageFile[] = [];

    for (const [path, file] of this.files) {
      if (!prefix || path.startsWith(prefix)) {
        result.push({
          path,
          size: file.content.length,
          lastModified: file.lastModified,
          isDirectory: false,
        });
      }
    }
    return result;
  }

  /**
   * @param {string} path
   * @returns {Promise<number>}
   */
  async size(path: string): Promise<number> {
    const file = this.files.get(this.normalizePath(path));
    if (!file) throw new StorageFileNotFoundError(path);
    return file.content.length;
  }

  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async mimeType(path: string): Promise<string> {
    const file = this.files.get(this.normalizePath(path));
    if (!file) throw new StorageFileNotFoundError(path);
    return file.contentType;
  }

  /**
   * @param {string} path
   * @returns {Promise<Date>}
   */
  async lastModified(path: string): Promise<Date> {
    const file = this.files.get(this.normalizePath(path));
    if (!file) throw new StorageFileNotFoundError(path);
    return file.lastModified;
  }

  /**
   * @param {string} path
   * @returns {Promise<StorageFileMetadata | null>}
   */
  async metadata(path: string): Promise<StorageFileMetadata | null> {
    const file = this.files.get(this.normalizePath(path));
    if (!file) return null;
    return {
      size: file.content.length,
      contentType: file.contentType,
      lastModified: file.lastModified,
    };
  }

  // ── Test helpers ────────────────────────────────────────

  /** Get count of stored files */
  fileCount(): number {
    return this.files.size;
  }

  /** Assert a file exists at the given path */
  /**
   * @param {string} path
   */
  assertExists(path: string): void {
    if (!this.files.has(this.normalizePath(path))) {
      throw new Error(`Expected file at "${path}" but it does not exist.`);
    }
  }

  /** Assert a file does NOT exist */
  /**
   * @param {string} path
   */
  assertMissing(path: string): void {
    if (this.files.has(this.normalizePath(path))) {
      throw new Error(`Expected file at "${path}" to NOT exist, but it does.`);
    }
  }

  /** Assert file content matches */
  /**
   * @param {string} path
   * @param {string} expected
   * @returns {Promise<void>}
   */
  async assertContent(path: string, expected: string): Promise<void> {
    const buf = await this.get(path);
    if (!buf) throw new Error(`File not found: ${path}`);
    const actual = buf.toString("utf-8");
    if (actual !== expected) {
      throw new Error(`File "${path}" content mismatch.\nExpected: ${expected}\nActual: ${actual}`);
    }
  }

  /** Reset all stored files */
  reset(): void {
    this.files.clear();
  }

  private normalizePath(path: string): string {
    return path.replace(/^\/+/, "").replace(/\/+$/, "");
  }
}
