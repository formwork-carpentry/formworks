/**
 * @module @formwork/storage-s3
 * @description Type definitions for the S3 storage adapter.
 */

/** Configuration for S3StorageAdapter */
export interface S3Config {
  /** S3 bucket name */
  bucket: string;
  /** AWS region (default: 'us-east-1') */
  region?: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /** Custom endpoint for S3-compatible services (MinIO, R2, Spaces) */
  endpoint?: string;
  /** Force path-style URLs (required for MinIO, optional for S3) */
  forcePathStyle?: boolean;
  /** Custom fetch for testing */
  fetchFn?: typeof fetch;
}
