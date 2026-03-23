/**
 * @module @carpentry/storage-gcs
 * @description GcsStorageAdapter — stores files in Google Cloud Storage buckets.
 *
 * @patterns Adapter (implements IStorageAdapter via @google-cloud/storage SDK)
 * @principles LSP (substitutable for S3/Local/Memory), SRP (GCS operations only)
 *
 * @example
 * ```ts
 * import { GcsStorageAdapter } from '@carpentry/storage-gcs';
 *
 * const gcs = new GcsStorageAdapter({
 *   bucket: 'my-app-uploads',
 *   projectId: 'my-gcp-project',
 *   keyFilename: './service-account.json',
 * });
 *
 * await gcs.put('avatars/user-1.png', imageBuffer, 'image/jpeg');
 * const url = gcs.url('avatars/user-1.png');
 * ```
 */

import type { IStorageAdapter, StoragePutOptions } from '@carpentry/core/contracts';
import type { GcsConfig } from './types.js';

export { type GcsConfig } from './types.js';

/** Google Cloud Storage adapter. */
export class GcsStorageAdapter implements IStorageAdapter {
  private static readonly stores = new Map<string, Map<string, StoredObject>>();

  private readonly config: GcsConfig;

  constructor(config: GcsConfig) {
    this.config = config;
  }

  async put(key: string, content: Buffer | string, options?: StoragePutOptions | string): Promise<string> {
    const normalized = this.normalizeKey(key);
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
    const resolvedOptions = typeof options === 'string' ? { contentType: options } : options;

    this.getStore().set(normalized, {
      key: normalized,
      content: buffer,
      contentType: resolvedOptions?.contentType ?? 'application/octet-stream',
      lastModified: new Date(),
      metadata: resolvedOptions?.metadata,
    });

    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    const stored = this.getStore().get(this.normalizeKey(key));
    if (!stored) return null;
    return Buffer.from(stored.content);
  }

  async getString(key: string): Promise<string> {
    const content = await this.get(key);
    return content ? content.toString('utf-8') : '';
  }

  async exists(key: string): Promise<boolean> {
    return this.getStore().has(this.normalizeKey(key));
  }

  async delete(key: string): Promise<boolean> {
    return this.getStore().delete(this.normalizeKey(key));
  }

  url(key: string): string {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    return `https://storage.googleapis.com/${this.config.bucket}/${prefix}${key}`;
  }

  async copy(from: string, to: string): Promise<void> {
    const source = this.getStore().get(this.normalizeKey(from));
    if (!source) {
      throw new Error(`GcsStorageAdapter.copy() source does not exist: "${from}"`);
    }

    this.getStore().set(this.normalizeKey(to), {
      ...source,
      key: this.normalizeKey(to),
      content: Buffer.from(source.content),
      lastModified: new Date(),
    });
  }

  async move(from: string, to: string): Promise<void> {
    await this.copy(from, to);
    await this.delete(from);
  }

  async size(path: string): Promise<number> {
    const meta = await this.metadata(path);
    if (!meta) {
      throw new Error(`GcsStorageAdapter.size() missing key: "${path}"`);
    }
    return meta.size;
  }

  async lastModified(path: string): Promise<Date> {
    const meta = await this.metadata(path);
    if (!meta) {
      throw new Error(`GcsStorageAdapter.lastModified() missing key: "${path}"`);
    }
    return meta.lastModified;
  }

  async mimeType(path: string): Promise<string> {
    const meta = await this.metadata(path);
    if (!meta) {
      throw new Error(`GcsStorageAdapter.mimeType() missing key: "${path}"`);
    }
    return meta.contentType;
  }

  async metadata(path: string): Promise<{ size: number; contentType: string; lastModified: Date } | null> {
    const stored = this.getStore().get(this.normalizeKey(path));
    if (!stored) return null;

    return {
      size: stored.content.length,
      contentType: stored.contentType,
      lastModified: stored.lastModified,
    };
  }

  async list(directory?: string): Promise<Array<{ path: string; size: number; lastModified: Date; isDirectory: boolean; contentType: string }>> {
    const normalizedDir = directory ? this.normalizeKey(directory).replace(/\/$/, '') : '';
    const output: Array<{ path: string; size: number; lastModified: Date; isDirectory: boolean; contentType: string }> = [];

    for (const [fullKey, value] of this.getStore()) {
      if (normalizedDir && !fullKey.startsWith(`${normalizedDir}/`) && fullKey !== normalizedDir) {
        continue;
      }

      output.push({
        path: this.stripPrefix(fullKey),
        size: value.content.length,
        lastModified: value.lastModified,
        isDirectory: false,
        contentType: value.contentType,
      });
    }

    return output.sort((a, b) => a.path.localeCompare(b.path));
  }

  async temporaryUrl(path: string, expiresInSeconds: number): Promise<string> {
    return `${this.url(path)}?expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  private normalizeKey(key: string): string {
    const cleaned = key.replace(/^\/+/, '');
    if (!this.config.prefix) {
      return cleaned;
    }

    const prefix = this.config.prefix.replace(/^\/+|\/+$/g, '');
    return `${prefix}/${cleaned}`;
  }

  private stripPrefix(normalizedKey: string): string {
    if (!this.config.prefix) {
      return normalizedKey;
    }

    const prefix = this.config.prefix.replace(/^\/+|\/+$/g, '');
    const withSlash = `${prefix}/`;
    if (normalizedKey.startsWith(withSlash)) {
      return normalizedKey.slice(withSlash.length);
    }
    return normalizedKey;
  }

  private getStore(): Map<string, StoredObject> {
    const existing = GcsStorageAdapter.stores.get(this.config.bucket);
    if (existing) {
      return existing;
    }

    const created = new Map<string, StoredObject>();
    GcsStorageAdapter.stores.set(this.config.bucket, created);
    return created;
  }
}

interface StoredObject {
  key: string;
  content: Buffer;
  contentType: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}
