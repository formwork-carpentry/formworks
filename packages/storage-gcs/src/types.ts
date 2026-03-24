/**
 * @module @carpentry/storage-gcs
 * @description Type definitions for the Google Cloud Storage adapter.
 */

/** Configuration for GcsStorageAdapter */
export interface GcsConfig {
  /** GCS bucket name */
  bucket: string;
  /** GCP project ID */
  projectId?: string;
  /** Path to a service account key JSON file */
  keyFilename?: string;
  /** Optional key prefix (virtual directory) */
  prefix?: string;
}
