/**
 * @module @carpentry/core/contracts/search
 * @description Full-text search contract - all search adapters implement this interface.
 *
 * Implementations: DatabaseSearchAdapter, MeilisearchAdapter, TypesenseAdapter, AlgoliaAdapter
 *
 * @example
 * ```ts
 * const search = container.make<ISearchEngine>('search');
 * await search.index('products', { id: '42', title: 'Widget', price: 9.99 });
 * const results = await search.search('products', 'widget');
 * ```
 */

/** A single search result with relevance scoring. */
export interface SearchResult<T = Record<string, unknown>> {
  /** The matched document */
  document: T;
  /** Relevance score (higher = more relevant) */
  score?: number;
  /** Highlighted snippets keyed by field name */
  highlights?: Record<string, string>;
}

/** Paginated search results. */
export interface SearchResults<T = Record<string, unknown>> {
  hits: SearchResult<T>[];
  total: number;
  page: number;
  perPage: number;
  /** Time taken in milliseconds */
  took?: number;
}

/** Search query options. */
export interface SearchOptions {
  /** Page number (1-based, default: 1) */
  page?: number;
  /** Results per page (default: 20) */
  perPage?: number;
  /** Filter expression (driver-specific syntax) */
  filter?: string | Record<string, unknown>;
  /** Sort expression (e.g., 'price:asc') */
  sort?: string | string[];
  /** Fields to search in (default: all searchable fields) */
  searchableFields?: string[];
  /** Fields to return (default: all) */
  attributesToRetrieve?: string[];
}

/** @typedef {Object} ISearchEngine - Full-text search contract */
export interface ISearchEngine {
  /**
   * Index (upsert) a document.
   * @param {string} index - Index/collection name
   * @param {Record<string, unknown>} document - Document to index (must include 'id')
   */
  index(index: string, document: Record<string, unknown>): Promise<void>;

  /**
   * Index multiple documents in bulk.
   * @param {string} index - Index/collection name
   * @param {Record<string, unknown>[]} documents - Documents to index
   */
  indexMany(index: string, documents: Record<string, unknown>[]): Promise<void>;

  /**
   * Search an index.
   * @param {string} index - Index/collection name
   * @param {string} query - Search query string
   * @param {SearchOptions} [options] - Pagination, filters, sorting
   * @returns {Promise<SearchResults>} Paginated search results
   */
  search<T = Record<string, unknown>>(
    index: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResults<T>>;

  /**
   * Remove a document from the index.
   * @param {string} index - Index/collection name
   * @param {string} documentId - Document ID to remove
   */
  remove(index: string, documentId: string): Promise<void>;

  /**
   * Drop an entire index.
   * @param {string} index - Index/collection name
   */
  dropIndex(index: string): Promise<void>;

  /**
   * Create an index with settings.
   * @param {string} index - Index/collection name
   * @param {Record<string, unknown>} [settings] - Index settings (searchable fields, etc.)
   */
  createIndex(index: string, settings?: Record<string, unknown>): Promise<void>;
}
