/**
 * @module @formwork/db-mongodb/helpers/query
 * @description Query helper functions for MongoDB document operations.
 */
import type { DocumentFilter, DocumentQueryOptions } from '../types.js';

/**
 * Normalize a Carpenter document filter into a MongoDB query object.
 *
 * @param filter - Carpenter filter.
 * @returns MongoDB filter document.
 */
export function toMongoFilter<TDocument extends Record<string, unknown>>(
  filter?: DocumentFilter<TDocument>,
): Record<string, unknown> {
  return { ...(filter ?? {}) };
}

/**
 * Resolve the adapter collection name from config.
 *
 * @param collection - Configured collection name.
 * @returns Collection name.
 */
export function resolveCollectionName(collection?: string): string {
  return collection ?? 'documents';
}

/**
 * Build a Mongo sort document from Carpenter query options.
 *
 * @param options - Document query options.
 * @returns Mongo sort document or `null`.
 */
export function toMongoSort<TDocument extends Record<string, unknown>>(
  options: DocumentQueryOptions<TDocument>,
): Record<string, 1 | -1> | null {
  if (!options.sort) {
    return null;
  }
  return {
    [String(options.sort.field)]: options.sort.direction === 'desc' ? -1 : 1,
  };
}

/**
 * Normalize a Mongo identifier into the Carpenter string format.
 *
 * @param value - Driver identifier.
 * @returns Normalized identifier string.
 */
export function normalizeInsertedId(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'toHexString' in value) {
    const candidate = value as { toHexString?: () => string };
    if (typeof candidate.toHexString === 'function') {
      return candidate.toHexString();
    }
  }
  return String(value);
}
