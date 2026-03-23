/**
 * @module @carpentry/storage
 * @description LocalStorageAdapter — stores files on the local filesystem
 * @patterns Adapter (implements IStorageAdapter)
 * @principles LSP (substitutable for S3/GCS), SRP (local file I/O only)
 */

import { promises as fs } from "node:fs";
import { dirname, extname, join } from "node:path";
import type {
  IStorageAdapter,
  StorageFile,
  StorageFileMetadata,
  StoragePutOptions,
} from "@carpentry/formworks/core/contracts";

export interface LocalStorageConfig {
  /** Root directory for file storage */
  root: string;
  /** Base URL for public files (optional) */
  baseUrl?: string;
}

/**
 * Local filesystem storage adapter.
 *
 * @example
 * ```ts
 * const storage = new LocalStorageAdapter({ root: '/app/storage' });
 * await storage.put('avatars/user-1.png', imageBuffer);
 * const exists = await storage.exists('avatars/user-1.png');
 * const url = storage.url('avatars/user-1.png');
 * ```
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(config: LocalStorageConfig) {
    this.root = config.root;
    this.baseUrl = config.baseUrl ?? "";
  }

  /** Store a file */
  /**
   * @param {string} path
   * @param {Buffer | string} content
   * @param {StoragePutOptions | string} [options]
   * @returns {Promise<string>}
   */
  async put(
    path: string,
    content: Buffer | string,
    _options?: StoragePutOptions | string,
  ): Promise<string> {
    const normalizedPath = this.normalizePath(path);
    const fullPath = this.fullPath(normalizedPath);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return normalizedPath;
  }

  /** Read a file's content */
  /**
   * @param {string} path
   * @returns {Promise<Buffer | null>}
   */
  async get(path: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.fullPath(path));
    } catch {
      return null;
    }
  }

  /** Read a file as string */
  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async getString(path: string): Promise<string> {
    return fs.readFile(this.fullPath(path), "utf-8");
  }

  /** Check if a file exists */
  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(path));
      return true;
    } catch {
      return false;
    }
  }

  /** Delete a file */
  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async delete(path: string): Promise<boolean> {
    try {
      await fs.unlink(this.fullPath(path));
      return true;
    } catch {
      return false;
    }
  }

  /** Copy a file */
  /**
   * @param {string} from
   * @param {string} to
   * @returns {Promise<void>}
   */
  async copy(from: string, to: string): Promise<void> {
    const destPath = this.fullPath(to);
    await fs.mkdir(dirname(destPath), { recursive: true });
    await fs.copyFile(this.fullPath(from), destPath);
  }

  /** Move a file */
  /**
   * @param {string} from
   * @param {string} to
   * @returns {Promise<void>}
   */
  async move(from: string, to: string): Promise<void> {
    const destPath = this.fullPath(to);
    await fs.mkdir(dirname(destPath), { recursive: true });
    await fs.rename(this.fullPath(from), destPath);
  }

  /** Get file size in bytes */
  /**
   * @param {string} path
   * @returns {Promise<number>}
   */
  async size(path: string): Promise<number> {
    const stat = await fs.stat(this.fullPath(path));
    return stat.size;
  }

  /** Get last modified date */
  /**
   * @param {string} path
   * @returns {Promise<Date>}
   */
  async lastModified(path: string): Promise<Date> {
    const stat = await fs.stat(this.fullPath(path));
    return stat.mtime;
  }

  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  async mimeType(path: string): Promise<string> {
    return this.detectContentType(path);
  }

  /**
   * @param {string} path
   * @returns {Promise<StorageFileMetadata | null>}
   */
  async metadata(path: string): Promise<StorageFileMetadata | null> {
    try {
      const stat = await fs.stat(this.fullPath(path));
      return {
        size: stat.size,
        contentType: this.detectContentType(path),
        lastModified: stat.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * @param {string} [directory]
   * @returns {Promise<StorageFile[]>}
   */
  async list(directory = ""): Promise<StorageFile[]> {
    const files = await this.allFiles(directory);
    const entries = await Promise.all(
      files.map(async (filePath) => {
        const stat = await fs.stat(this.fullPath(filePath));
        return {
          path: filePath,
          size: stat.size,
          lastModified: stat.mtime,
          isDirectory: false,
        } satisfies StorageFile;
      }),
    );
    return entries;
  }

  /** List files in a directory */
  /**
   * @param {string} [directory]
   * @returns {Promise<string[]>}
   */
  async files(directory = ""): Promise<string[]> {
    const dirPath = this.fullPath(directory);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => (directory ? `${directory}/${e.name}` : e.name));
    } catch {
      return [];
    }
  }

  /** List all files recursively */
  /**
   * @param {string} [directory]
   * @returns {Promise<string[]>}
   */
  async allFiles(directory = ""): Promise<string[]> {
    const results: string[] = [];
    await this.walkDir(this.fullPath(directory), directory, results);
    return results;
  }

  /** List subdirectories */
  /**
   * @param {string} [directory]
   * @returns {Promise<string[]>}
   */
  async directories(directory = ""): Promise<string[]> {
    const dirPath = this.fullPath(directory);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => (directory ? `${directory}/${e.name}` : e.name));
    } catch {
      return [];
    }
  }

  /** Create a directory */
  /**
   * @param {string} path
   * @returns {Promise<void>}
   */
  async makeDirectory(path: string): Promise<void> {
    await fs.mkdir(this.fullPath(path), { recursive: true });
  }

  /** Delete a directory and all contents */
  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async deleteDirectory(path: string): Promise<boolean> {
    try {
      await fs.rm(this.fullPath(path), { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /** Get a public URL for a file */
  /**
   * @param {string} path
   * @returns {string}
   */
  url(path: string): string {
    const normalizedPath = this.normalizePath(path);
    return this.baseUrl ? `${this.baseUrl}/${normalizedPath}` : normalizedPath;
  }

  /** Create a temporary URL for a file */
  /**
   * @param {string} path
   * @param {number} expiresInSeconds
   * @returns {Promise<string>}
   */
  async temporaryUrl(path: string, expiresInSeconds: number): Promise<string> {
    return `${this.url(path)}?expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  /** Append content to a file */
  /**
   * @param {string} path
   * @param {string} content
   * @returns {Promise<void>}
   */
  async append(path: string, content: string): Promise<void> {
    const fullPath = this.fullPath(path);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, content);
  }

  /** Prepend content to a file */
  /**
   * @param {string} path
   * @param {string} content
   * @returns {Promise<void>}
   */
  async prepend(path: string, content: string): Promise<void> {
    const existing = (await this.exists(path)) ? await this.getString(path) : "";
    await this.put(path, content + existing);
  }

  private fullPath(path: string): string {
    return join(this.root, this.normalizePath(path));
  }

  private normalizePath(path: string): string {
    return path.replace(/^\/+/, "").replace(/\\/g, "/");
  }

  private detectContentType(path: string): string {
    switch (extname(path).toLowerCase()) {
      case ".txt":
        return "text/plain";
      case ".json":
        return "application/json";
      case ".html":
        return "text/html";
      case ".css":
        return "text/css";
      case ".js":
        return "text/javascript";
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".svg":
        return "image/svg+xml";
      case ".pdf":
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  }

  private async walkDir(dir: string, prefix: string, results: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isFile()) {
          results.push(relPath);
        } else if (entry.isDirectory()) {
          await this.walkDir(join(dir, entry.name), relPath, results);
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }
}
