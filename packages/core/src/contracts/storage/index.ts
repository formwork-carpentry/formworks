/**
 * @module @carpentry/core/contracts/storage
 * @description File storage contract - all storage adapters implement this interface.
 *
 * Implementations: MemoryStorageAdapter, LocalStorageAdapter, S3StorageAdapter
 *
 * @example
 * ```ts
 * const storage = container.make<IStorageAdapter>('storage');
 * await storage.put('uploads/photo.jpg', imageBuffer, 'image/jpeg');
 * const url = storage.url('uploads/photo.jpg');
 * ```
 */

export interface StoragePutOptions {
  contentType?: string;
  visibility?: "public" | "private";
  metadata?: Record<string, string>;
}

export interface StorageFileMetadata {
  size: number;
  contentType: string;
  lastModified: Date;
  etag?: string;
}

export interface StorageFile {
  path: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  contentType?: string;
}

/** @typedef {Object} IStorageAdapter - File storage contract */
export interface IStorageAdapter {
  /**
   * Store a file.
   * @param {string} path - File path relative to the disk root
   * @param {string | Buffer} content - File content
   * @param {StoragePutOptions | string} [options] - MIME type or richer options
   * @returns {Promise<string>} Stored path/key
   * @example
   * ```ts
   * await storage.put('avatars/user-42.jpg', imageBuffer, 'image/jpeg');
   * ```
   */
  put(
    path: string,
    content: string | Buffer,
    options?: StoragePutOptions | string,
  ): Promise<string>;

  /**
   * Retrieve a file's content.
   * @param {string} path - File path
   * @returns {Promise<Buffer | null>} File content as a Buffer, or null if missing
   */
  get(path: string): Promise<Buffer | null>;

  getString?(path: string): Promise<string>;

  /**
   * Check if a file exists.
   * @param {string} path - File path
   * @returns {Promise<boolean>} True if the file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete a file.
   * @param {string} path - File path
   * @returns {Promise<boolean>} True if the file was deleted
   */
  delete(path: string): Promise<boolean>;

  /**
   * Get a public URL for a file.
   * @param {string} path - File path
   * @returns {string} Public URL
   * @example
   * ```ts
   * const url = storage.url('uploads/photo.jpg');
   * // => 'https://s3.amazonaws.com/bucket/uploads/photo.jpg'
   * ```
   */
  url(path: string): string;

  /**
   * Copy a file to a new location.
   * @param {string} from - Source path
   * @param {string} to - Destination path
   * @returns {Promise<void>}
   */
  copy(from: string, to: string): Promise<void>;

  move(from: string, to: string): Promise<void>;

  size(path: string): Promise<number>;

  lastModified(path: string): Promise<Date>;

  mimeType(path: string): Promise<string>;

  /**
   * Get file metadata.
   * @param {string} path - File path
   * @returns {Promise<StorageFileMetadata | null>} Metadata or null if not found
   */
  metadata(path: string): Promise<StorageFileMetadata | null>;

  list(directory?: string): Promise<StorageFile[]>;

  temporaryUrl(path: string, expiresInSeconds: number): Promise<string>;
}
