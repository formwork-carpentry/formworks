/**
 * @module @formwork/db-mongodb/types
 * @description Shared MongoDB adapter configuration and driver contracts.
 */

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

/**
 * Runtime configuration consumed by {@link MongoDBAdapter}.
 *
 * @example
 * ```ts
 * const config: MongoDBConnectionConfig = {
 *   url: 'mongodb://localhost:27017',
 *   database: 'carpenter',
 *   collection: 'users',
 * };
 * ```
 */
export interface MongoDBConnectionConfig {
  driver?: 'mongodb';
  url: string;
  database: string;
  collection?: string;
  options?: Record<string, unknown>;
}

/** Minimal insert payload returned by Mongo drivers. */
export interface IMongoInsertOneResult {
  insertedId: unknown;
}

/** Minimal update payload returned by Mongo drivers. */
export interface IMongoUpdateResult {
  matchedCount: number;
  modifiedCount: number;
}

/** Minimal delete payload returned by Mongo drivers. */
export interface IMongoDeleteResult {
  deletedCount?: number;
}

/** Cursor contract used to keep query chaining decoupled from the driver package. */
export interface IMongoCursor<TDocument extends Record<string, unknown>> {
  sort(sort: Record<string, 1 | -1>): IMongoCursor<TDocument>;
  skip(count: number): IMongoCursor<TDocument>;
  limit(count: number): IMongoCursor<TDocument>;
  toArray(): Promise<TDocument[]>;
}

/** Collection contract consumed by the document adapter. */
export interface IMongoCollection<TDocument extends Record<string, unknown>> {
  find(filter: Record<string, unknown>): IMongoCursor<TDocument>;
  findOne(filter: Record<string, unknown>): Promise<TDocument | null>;
  insertOne(document: TDocument): Promise<IMongoInsertOneResult>;
  updateMany(filter: Record<string, unknown>, update: { $set: Partial<TDocument> }): Promise<IMongoUpdateResult>;
  deleteMany(filter: Record<string, unknown>): Promise<IMongoDeleteResult>;
  countDocuments(filter: Record<string, unknown>): Promise<number>;
}

/** Database contract used by the adapter after the client connects. */
export interface IMongoDatabase {
  collection<TDocument extends Record<string, unknown>>(name: string): IMongoCollection<TDocument>;
}

/** Mongo client contract used to abstract the optional driver package. */
export interface IMongoClient {
  connect(): Promise<void>;
  db(name: string): IMongoDatabase;
  close(): Promise<void>;
}

/** Minimal driver module surface loaded from `mongodb`. */
export interface IMongoDriverModule {
  MongoClient: new (uri: string, options?: Record<string, unknown>) => IMongoClient;
}

/** Lazy loader that resolves the optional MongoDB dependency when needed. */
export type MongoDriverLoader = () => Promise<IMongoDriverModule>;

/** Injectable collaborators for tests or externally managed clients. */
export interface MongoDBAdapterDependencies {
  client?: IMongoClient;
  driverLoader?: MongoDriverLoader;
}
