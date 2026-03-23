/**
 * @module @carpentry/db-filesystem
 * @description Public entrypoint for the filesystem document adapter package.
 */
export { FilesystemDocumentAdapter } from './FilesystemDocumentAdapter.js';
export type { FilesystemDocumentAdapterConfig } from './FilesystemDocumentAdapter.js';

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';
import { FilesystemDocumentAdapter } from './FilesystemDocumentAdapter.js';
import type { FilesystemDocumentAdapterConfig } from './FilesystemDocumentAdapter.js';

/**
 * DatabaseManager-compatible driver factory for the filesystem document adapter.
 *
 * @example
 * ```ts
 * import { filesystemAdapter } from '@carpentry/db-filesystem';
 * dbManager.registerDriver('filesystem', filesystemAdapter);
 * ```
 */
export const filesystemAdapter: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new FilesystemDocumentAdapter(config as unknown as FilesystemDocumentAdapterConfig);
