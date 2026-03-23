/**
 * @module @carpentry/db-filesystem/FilesystemDocumentAdapter
 * @description JSON-backed document adapter for lightweight local persistence.
 * @patterns Adapter, Proxy
 * @principles SRP — document persistence only, DIP — implements the shared document contract
 */
import { dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';

/** Document insert result shape. */
export interface DocumentInsertResult {
  insertedId: string;
}

/** Document update result shape. */
export interface DocumentUpdateResult {
  matchedCount: number;
  modifiedCount: number;
}

/** Document delete result shape. */
export interface DocumentDeleteResult {
  deletedCount: number;
}

/** Filter criteria for document queries. */
export type DocumentFilter<TDocument extends Record<string, unknown> = Record<string, unknown>> =
  Partial<TDocument>;

/** Query options for document listing methods. */
export interface DocumentQueryOptions<TDocument extends Record<string, unknown> = Record<string, unknown>> {
  filter?: DocumentFilter<TDocument>;
  sort?: { field: keyof TDocument & string; direction: 'asc' | 'desc' };
  skip?: number;
  limit?: number;
}

/** Document database adapter contract. */
export interface IDocumentDatabaseAdapter<TDocument extends Record<string, unknown> = Record<string, unknown>> {
  driverName(): string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  find(options?: DocumentQueryOptions<TDocument>): Promise<TDocument[]>;
  findOne(filter?: DocumentFilter<TDocument>): Promise<TDocument | null>;
  insert(document: TDocument): Promise<DocumentInsertResult>;
  update(filter: DocumentFilter<TDocument>, patch: Partial<TDocument>): Promise<DocumentUpdateResult>;
  delete(filter: DocumentFilter<TDocument>): Promise<DocumentDeleteResult>;
  count(filter?: DocumentFilter<TDocument>): Promise<number>;
}

/** Configuration for the filesystem document adapter. */
export interface FilesystemDocumentAdapterConfig<TDocument extends Record<string, unknown> = Record<string, unknown>> {
  /** Optional driver identifier to keep configs descriptive. */
  driver?: 'filesystem';
  /** Full path to the JSON file used as the document store. */
  file: string;
  /** Field used as the unique document identifier. */
  idField?: keyof TDocument;
}

/**
 * Simple JSON-backed document adapter that demonstrates how to satisfy the
 * `IDocumentDatabaseAdapter` contract without pulling in a heavyweight binary.
 *
 * @patterns Adapter, Proxy (file persistence)
 * @principles DRY - every persistence concern funnels through shared helpers
 */
export class FilesystemDocumentAdapter<TDocument extends Record<string, unknown> = Record<string, unknown>>
  implements IDocumentDatabaseAdapter<TDocument> {

  private readonly config: FilesystemDocumentAdapterConfig<TDocument>;
  private readonly filePath: string;
  private readonly identifier: keyof TDocument;
  private documents: TDocument[] = [];
  private connected = false;
  private pendingWrite: Promise<void> = Promise.resolve();

  /** @param config - Adapter configuration. */
  constructor(config: FilesystemDocumentAdapterConfig<TDocument>) {
    this.config = config;
    this.filePath = config.file;
    this.identifier = config.idField ?? ('id' as keyof TDocument);
  }

  driverName(): string {
    return this.config.driver ?? 'filesystem';
  }

  async connect(): Promise<void> {
    const directory = dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    this.documents = await this.loadDocuments();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async find(options: DocumentQueryOptions<TDocument> = {}): Promise<TDocument[]> {
    this.ensureConnected();
    const filtered = this.applyQuery(await this.refresh(), options);
    return filtered;
  }

  async findOne(filter: DocumentFilter<TDocument> = {} as DocumentFilter<TDocument>): Promise<TDocument | null> {
    this.ensureConnected();
    const [result] = this.applyQuery(await this.refresh(), { filter, limit: 1 });
    return result ?? null;
  }

  async insert(document: TDocument): Promise<DocumentInsertResult> {
    this.ensureConnected();
    const docs = await this.refresh();
    const id = randomUUID();
    const record = { ...document, [this.identifier]: id } as TDocument;
    docs.push(record);
    await this.persist(docs);
    return { insertedId: id };
  }

  async update(filter: DocumentFilter<TDocument>, patch: Partial<TDocument>): Promise<DocumentUpdateResult> {
    this.ensureConnected();
    const docs = await this.refresh();
    let matched = 0;
    let modified = 0;
    const updated = docs.map((doc) => {
      if (!this.matches(doc, filter)) return doc;
      matched += 1;
      const merged = { ...doc, ...patch };
      if (!this.isEquivalent(doc, merged)) {
        modified += 1;
      }
      return merged;
    });
    if (matched) {
      await this.persist(updated);
    }
    return { matchedCount: matched, modifiedCount: modified };
  }

  async delete(filter: DocumentFilter<TDocument>): Promise<DocumentDeleteResult> {
    this.ensureConnected();
    const docs = await this.refresh();
    const remaining: TDocument[] = [];
    let removed = 0;
    for (const doc of docs) {
      if (this.matches(doc, filter)) {
        removed += 1;
        continue;
      }
      remaining.push(doc);
    }
    if (removed) {
      await this.persist(remaining);
    }
    return { deletedCount: removed };
  }

  async count(filter: DocumentFilter<TDocument> = {} as DocumentFilter<TDocument>): Promise<number> {
    this.ensureConnected();
    return this.applyQuery(await this.refresh(), { filter }).length;
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('FilesystemDocumentAdapter must be connected before usage.');
    }
  }

  private async refresh(): Promise<TDocument[]> {
    this.documents = await this.loadDocuments();
    return this.documents;
  }

  private async loadDocuments(): Promise<TDocument[]> {
    try {
      const contents = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(contents);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async persist(documents: TDocument[]): Promise<void> {
    await this.enqueueWrite(async () => {
      await fs.writeFile(this.filePath, JSON.stringify(documents, null, 2), 'utf-8');
    });
    this.documents = documents;
  }

  private enqueueWrite(work: () => Promise<void>): Promise<void> {
    const next = this.pendingWrite.then(() => work());
    this.pendingWrite = next.catch(() => undefined);
    return next;
  }

  private applyQuery(documents: TDocument[], options: DocumentQueryOptions<TDocument>): TDocument[] {
    let result = documents.filter((doc) => this.matches(doc, options.filter));

    if (options.sort) {
      const direction = options.sort.direction === 'desc' ? -1 : 1;
      const { field } = options.sort;
      result = result.slice().sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];
        return this.compareValues(aValue, bValue, direction);
      });
    }

    const skip = Math.max(options.skip ?? 0, 0);
    const limit = options.limit ? Math.max(options.limit, 0) : undefined;
    if (limit !== undefined) {
      return result.slice(skip, skip + limit);
    }
    return result.slice(skip);
  }

  private matches(document: TDocument, filter?: DocumentFilter<TDocument>): boolean {
    if (!filter) return true;
    for (const [key, value] of Object.entries(filter)) {
      const actual = document[key];
      if (!this.isEquivalent(actual, value)) {
        return false;
      }
    }
    return true;
  }

  private isEquivalent(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
      return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      return a.every((value, index) => this.isEquivalent(value, b[index]));
    }
    if (this.isRecord(a) && this.isRecord(b)) {
      const leftKeys = Object.keys(a);
      const rightKeys = Object.keys(b);
      if (leftKeys.length !== rightKeys.length) {
        return false;
      }
      return leftKeys.every((key) => this.isEquivalent((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
    }
    return false;
  }

  private compareValues(left: unknown, right: unknown, direction: number): number {
    if (left === right) return 0;
    if (left == null) return -direction;
    if (right == null) return direction;
    if (typeof left === 'number' && typeof right === 'number') {
      return left > right ? direction : -direction;
    }
    const leftValue = String(left);
    const rightValue = String(right);
    if (leftValue === rightValue) return 0;
    return leftValue > rightValue ? direction : -direction;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
