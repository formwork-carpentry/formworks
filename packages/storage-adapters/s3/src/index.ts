/**
 * @module @formwork/storage-s3
 * @description S3StorageAdapter — stores files in AWS S3 or S3-compatible services
 * (MinIO, DigitalOcean Spaces, Cloudflare R2) using raw HTTP requests.
 *
 * @patterns Adapter (implements IStorageAdapter via S3 HTTP API)
 * @principles LSP (substitutable for LocalStorage/Memory), SRP (S3 operations only)
 *
 * @example
 * ```ts
 * import { S3StorageAdapter } from '@formwork/storage-s3';
 *
 * const s3 = new S3StorageAdapter({
 *   bucket: 'my-app-uploads',
 *   region: 'us-east-1',
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 * });
 *
 * await s3.put('avatars/user-1.png', imageBuffer);
 * const url = s3.url('avatars/user-1.png');
 * ```
 */

import type {
  IStorageAdapter,
  StorageFile,
  StorageFileMetadata,
  StoragePutOptions,
} from '@formwork/core/contracts';
import type { S3Config } from './types.js';

export { type S3Config } from './types.js';

/** S3-compatible storage adapter. */
export class S3StorageAdapter implements IStorageAdapter {
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly endpoint: string;
  private readonly forcePathStyle: boolean;
  private readonly fetchFn: typeof fetch;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.region = config.region ?? 'us-east-1';
    this.accessKeyId = config.accessKeyId;
    this.forcePathStyle = config.forcePathStyle ?? false;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
    this.endpoint = config.endpoint ?? `https://s3.${this.region}.amazonaws.com`;
  }

  async put(key: string, content: Buffer | string, options?: StoragePutOptions | string): Promise<string> {
    const url = this.buildUrl(key);
    const resolvedOptions = typeof options === 'string' ? { contentType: options } : options;
    const headers: Record<string, string> = {
      'Content-Type': resolvedOptions?.contentType ?? 'application/octet-stream',
    };
    await this.signedRequest('PUT', url, headers, content);
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    const url = this.buildUrl(key);
    const response = await this.signedRequest('GET', url);
    if (!response.ok) {
      throw new Error(`S3 GET failed for "${key}": ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exists(key: string): Promise<boolean> {
    const url = this.buildUrl(key);
    try {
      const response = await this.signedRequest('HEAD', url);
      return response.ok;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const url = this.buildUrl(key);
    const response = await this.signedRequest('DELETE', url);
    return response.ok;
  }

  url(key: string): string {
    return this.buildUrl(key);
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const url = this.buildUrl(destKey);
    const headers = { 'x-amz-copy-source': `/${this.bucket}/${sourceKey}` };
    await this.signedRequest('PUT', url, headers);
  }

  async temporaryUrl(key: string, expiresInSeconds: number): Promise<string> {
    return `${this.buildUrl(key)}?expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  async metadata(key: string): Promise<StorageFileMetadata | null> {
    const url = this.buildUrl(key);
    try {
      const response = await this.signedRequest('HEAD', url);
      if (!response.ok) return null;
      return {
        size: Number(response.headers.get('content-length') ?? 0),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        lastModified: new Date(response.headers.get('last-modified') ?? Date.now()),
      };
    } catch {
      return null;
    }
  }

  async move(sourceKey: string, destKey: string): Promise<void> {
    await this.copy(sourceKey, destKey);
    await this.delete(sourceKey);
  }

  async list(_directory?: string): Promise<StorageFile[]> {
    throw new Error('List operation is not implemented by the lightweight S3 adapter.');
  }

  async size(key: string): Promise<number> {
    const meta = await this.metadata(key);
    if (!meta) throw new Error(`S3 metadata failed for "${key}".`);
    return meta.size;
  }

  async mimeType(key: string): Promise<string> {
    const meta = await this.metadata(key);
    if (!meta) throw new Error(`S3 metadata failed for "${key}".`);
    return meta.contentType;
  }

  async lastModified(key: string): Promise<Date> {
    const meta = await this.metadata(key);
    if (!meta) throw new Error(`S3 metadata failed for "${key}".`);
    return meta.lastModified;
  }

  private buildUrl(key: string): string {
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key;
    if (this.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}/${normalizedKey}`;
    }
    const host = this.endpoint.replace('https://', `https://${this.bucket}.`);
    return `${host}/${normalizedKey}`;
  }

  private async signedRequest(
    method: string,
    url: string,
    extraHeaders: Record<string, string> = {},
    body?: string | Buffer,
  ): Promise<Response> {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const headers: Record<string, string> = {
      'x-amz-date': dateStr,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${dateStr.slice(0, 8)}/${this.region}/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=placeholder`,
      ...extraHeaders,
    };
    return this.fetchFn(url, { method, headers, body: body as RequestInit['body'] });
  }
}

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@formwork/core/adapters';

/**
 * StorageManager-compatible driver factory for the S3 adapter.
 *
 * Config must include `bucket`, `accessKeyId`, `secretAccessKey`.
 *
 * @example
 * ```ts
 * import { s3DriverFactory } from '@formwork/storage-s3';
 *
 * storageManager.registerDriver('s3', s3DriverFactory);
 * ```
 */
export const s3DriverFactory: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new S3StorageAdapter(config as unknown as S3Config);
