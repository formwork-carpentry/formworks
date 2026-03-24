/**
 * @module @carpentry/storage-azure
 * @description Type definitions for the Azure Blob Storage adapter.
 */

/** Configuration for AzureStorageAdapter */
export interface AzureConfig {
  /** Azure storage account name */
  accountName: string;
  /** Azure storage account key */
  accountKey?: string;
  /** Azure storage connection string (alternative to accountName + accountKey) */
  connectionString?: string;
  /** Blob container name */
  container: string;
  /** Optional key prefix (virtual directory) */
  prefix?: string;
}
