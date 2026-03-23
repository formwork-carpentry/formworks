/**
 * @module @carpentry/storage-azure
 * @description AzureStorageAdapter — stores files in Azure Blob Storage containers.
 *
 * @patterns Adapter (implements IStorageAdapter via @azure/storage-blob SDK)
 * @principles LSP (substitutable for S3/GCS/Local), SRP (Azure Blob operations only)
 *
 * @example
 * ```ts
 * import { AzureStorageAdapter } from '@carpentry/storage-azure';
 *
 * const azure = new AzureStorageAdapter({
 *   accountName: 'myaccount',
 *   accountKey: process.env.AZURE_STORAGE_KEY!,
 *   container: 'uploads',
 * });
 *
 * await azure.put('avatars/user-1.png', imageBuffer, 'image/jpeg');
 * const url = azure.url('avatars/user-1.png');
 * ```
 */

import type { IStorageAdapter, StoragePutOptions } from '@carpentry/core/contracts';
import type { AzureConfig } from './types.js';

export { type AzureConfig } from './types.js';

/** Azure Blob Storage adapter. */
export class AzureStorageAdapter implements IStorageAdapter {
  private readonly config: AzureConfig;

  constructor(config: AzureConfig) {
    this.config = config;
  }

  async put(key: string, content: Buffer | string, options?: StoragePutOptions | string): Promise<string> {
    void content; void options;
    throw new Error(`AzureStorageAdapter.put("${key}") not yet implemented — install @azure/storage-blob`);
  }

  async get(key: string): Promise<Buffer | null> {
    throw new Error(`AzureStorageAdapter.get("${key}") not yet implemented`);
  }

  async exists(key: string): Promise<boolean> {
    void key;
    throw new Error('AzureStorageAdapter.exists() not yet implemented');
  }

  async delete(key: string): Promise<boolean> {
    void key;
    throw new Error('AzureStorageAdapter.delete() not yet implemented');
  }

  url(key: string): string {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    return `https://${this.config.accountName}.blob.core.windows.net/${this.config.container}/${prefix}${key}`;
  }

  async copy(from: string, to: string): Promise<string> {
    void from;
    throw new Error('AzureStorageAdapter.copy() not yet implemented');
    return to;
  }

  async move(from: string, to: string): Promise<string> {
    await this.copy(from, to);
    await this.delete(from);
    return to;
  }
}
