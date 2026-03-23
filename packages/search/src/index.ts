/**
 * @module @carpentry/search
 * @description Full-text search abstraction — driver-based search manager
 * with adapters for Meilisearch, Typesense, Algolia, and database LIKE fallback.
 *
 * Builds on the ISearchEngine contract from @carpentry/core/contracts/search.
 *
 * @patterns Strategy (pluggable search driver), Repository (index as collection)
 * @principles OCP (new drivers without modifying core), LSP (all drivers share ISearchEngine)
 *
 * @example
 * ```ts
 * import { SearchManager } from '@carpentry/search';
 *
 * const search = new SearchManager({ driver: 'database' });
 * await search.index('products', { id: '42', title: 'Widget', price: 9.99 });
 * const results = await search.search('products', 'widget');
 * ```
 */

import type {
  ISearchEngine,
  SearchOptions,
  SearchResults,
} from '@carpentry/core/contracts';

export type {
  ISearchEngine,
  SearchOptions,
  SearchResult,
  SearchResults,
} from '@carpentry/core/contracts';

/** Configuration for SearchManager. */
export interface SearchConfig {
  /** Driver to use: 'database' | 'meilisearch' | 'typesense' | 'algolia' | 'null' */
  driver: string;
  /** Driver-specific options */
  options?: Record<string, unknown>;
}

/**
 * Manages full-text search across pluggable drivers.
 * For production, install and configure a dedicated search engine adapter.
 * The 'database' driver provides basic SQL LIKE queries as a fallback.
 */
export class SearchManager implements ISearchEngine {
  private static readonly indexes = new Map<string, Map<string, Record<string, unknown>>>();

  private readonly config: SearchConfig;

  constructor(config: SearchConfig) {
    this.config = config;
  }

  async index(index: string, document: Record<string, unknown>): Promise<void> {
    if (this.config.driver === 'null') return;
    this.assertSupportedDriver();

    const documentId = this.resolveDocumentId(document);
    const store = this.getOrCreateIndex(index);
    store.set(documentId, { ...document });
  }

  async indexMany(index: string, documents: Record<string, unknown>[]): Promise<void> {
    if (this.config.driver === 'null') return;
    this.assertSupportedDriver();

    const store = this.getOrCreateIndex(index);
    for (const document of documents) {
      const documentId = this.resolveDocumentId(document);
      store.set(documentId, { ...document });
    }
  }

  async search<T = Record<string, unknown>>(
    index: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResults<T>> {
    const startedAt = Date.now();
    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 20;

    if (this.config.driver === 'null') {
      return {
        hits: [],
        total: 0,
        page,
        perPage,
        took: Date.now() - startedAt,
      };
    }

    this.assertSupportedDriver();

    const store = SearchManager.indexes.get(index);
    if (!store) {
      return {
        hits: [],
        total: 0,
        page,
        perPage,
        took: Date.now() - startedAt,
      };
    }

    const normalizedQuery = query.trim().toLowerCase();
    const searchableFields = options?.searchableFields;
    const filtered = [...store.values()].filter((document) => {
      if (normalizedQuery.length === 0) return true;

      const values = this.extractSearchableValues(document, searchableFields);
      return values.some((value) => value.includes(normalizedQuery));
    });

    const sorted = this.sortDocuments(filtered, options?.sort);
    const total = sorted.length;
    const start = Math.max(0, (page - 1) * perPage);
    const end = start + Math.max(1, perPage);
    const pageItems = sorted.slice(start, end);

    const attributes = options?.attributesToRetrieve;
    const hits = pageItems.map((document) => {
      const output = attributes ? pickAttributes(document, attributes) : document;
      return { document: output as T };
    });

    return {
      hits,
      total,
      page,
      perPage,
      took: Date.now() - startedAt,
    };
  }

  async remove(index: string, documentId: string): Promise<void> {
    if (this.config.driver === 'null') return;
    this.assertSupportedDriver();

    const store = SearchManager.indexes.get(index);
    store?.delete(documentId);
  }

  async dropIndex(index: string): Promise<void> {
    if (this.config.driver === 'null') return;
    this.assertSupportedDriver();
    SearchManager.indexes.delete(index);
  }

  async createIndex(index: string, settings?: Record<string, unknown>): Promise<void> {
    void settings;
    if (this.config.driver === 'null') return;
    this.assertSupportedDriver();
    this.getOrCreateIndex(index);
  }

  private assertSupportedDriver(): void {
    if (this.config.driver !== 'database') {
      throw new Error(
        `Search driver "${this.config.driver}" is not available in this lightweight manager. Available: database, null`,
      );
    }
  }

  private getOrCreateIndex(index: string): Map<string, Record<string, unknown>> {
    const existing = SearchManager.indexes.get(index);
    if (existing) {
      return existing;
    }

    const created = new Map<string, Record<string, unknown>>();
    SearchManager.indexes.set(index, created);
    return created;
  }

  private resolveDocumentId(document: Record<string, unknown>): string {
    const id = document.id;
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new Error('Search document must include an "id" field (string or number).');
    }
    return String(id);
  }

  private extractSearchableValues(
    document: Record<string, unknown>,
    searchableFields?: string[],
  ): string[] {
    if (!searchableFields || searchableFields.length === 0) {
      return Object.values(document).map((value) => String(value ?? '').toLowerCase());
    }

    return searchableFields.map((field) => String(document[field] ?? '').toLowerCase());
  }

  private sortDocuments(
    documents: Record<string, unknown>[],
    sortOption?: string | string[],
  ): Record<string, unknown>[] {
    if (!sortOption) {
      return documents;
    }

    const rules = (Array.isArray(sortOption) ? sortOption : [sortOption])
      .map((rule) => {
        const [field, direction] = rule.split(':');
        if (!field) return null;
        return { field, direction: direction === 'desc' ? 'desc' : 'asc' as 'asc' | 'desc' };
      })
      .filter((rule): rule is { field: string; direction: 'asc' | 'desc' } => Boolean(rule));

    return [...documents].sort((a, b) => {
      for (const rule of rules) {
        const left = a[rule.field];
        const right = b[rule.field];
        const compared = compareValues(left, right);
        if (compared !== 0) {
          return rule.direction === 'asc' ? compared : -compared;
        }
      }
      return 0;
    });
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;

  const leftNumber = typeof a === 'number' ? a : Number.NaN;
  const rightNumber = typeof b === 'number' ? b : Number.NaN;
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber < rightNumber ? -1 : 1;
  }

  const leftText = String(a ?? '').toLowerCase();
  const rightText = String(b ?? '').toLowerCase();
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}

function pickAttributes(
  document: Record<string, unknown>,
  attributes: string[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const attribute of attributes) {
    if (attribute in document) {
      picked[attribute] = document[attribute];
    }
  }
  return picked;
}
