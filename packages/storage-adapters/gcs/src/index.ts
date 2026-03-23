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
  private readonly config: GcsConfig;

  constructor(config: GcsConfig) {
    this.config = config;
  }

  async put(key: string, content: Buffer | string, options?: StoragePutOptions | string): Promise<string> {
    void content; void options;
    throw new Error(`GcsStorageAdapter.put("${key}") not yet implemented — install @google-cloud/storage`);
  }

  async get(key: string): Promise<Buffer | null> {
    throw new Error(`GcsStorageAdapter.get("${key}") not yet implemented`);
  }

  async exists(key: string): Promise<boolean> {
    void key;
    throw new Error('GcsStorageAdapter.exists() not yet implemented');
  }

  async delete(key: string): Promise<boolean> {
    void key;
    throw new Error('GcsStorageAdapter.delete() not yet implemented');
  }

  url(key: string): string {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    return `https://storage.googleapis.com/${this.config.bucket}/${prefix}${key}`;
  }

  async copy(from: string, to: string): Promise<string> {
    void from;
    throw new Error(`GcsStorageAdapter.copy() not yet implemented`);
    return to;
  }

  async move(from: string, to: string): Promise<string> {
    await this.copy(from, to);
    await this.delete(from);
    return to;
  }
}
