/**
 * @module @carpentry/db-mongodb/MongoDBAdapter
 * @description MongoDB-backed document adapter.
 * @patterns Adapter, Strategy
 */
import type {
  DocumentDeleteResult,
  DocumentFilter,
  DocumentInsertResult,
  DocumentQueryOptions,
  DocumentUpdateResult,
  IDocumentDatabaseAdapter,
  IMongoClient,
  IMongoDatabase,
  MongoDBAdapterDependencies,
  MongoDBConnectionConfig,
  MongoDriverLoader,
} from './types.js';
import { loadMongoDriver } from './helpers/driverLoader.js';
import {
  normalizeInsertedId,
  resolveCollectionName,
  toMongoFilter,
  toMongoSort,
} from './helpers/query.js';

/**
 * MongoDB adapter that satisfies the document database contract.
 */
export class MongoDBAdapter<TDocument extends Record<string, unknown> = Record<string, unknown>>
  implements IDocumentDatabaseAdapter<TDocument> {

  private readonly config: MongoDBConnectionConfig;
  private client: IMongoClient | null;
  private database: IMongoDatabase | null = null;
  private readonly collectionName: string;
  private readonly ownsClient: boolean;
  private readonly driverLoader: MongoDriverLoader;

  constructor(config: MongoDBConnectionConfig, dependencies: MongoDBAdapterDependencies = {}) {
    this.config = config;
    this.client = dependencies.client ?? null;
    this.collectionName = resolveCollectionName(config.collection);
    this.ownsClient = dependencies.client === undefined;
    this.driverLoader = dependencies.driverLoader ?? loadMongoDriver;
  }

  driverName(): string {
    return 'mongodb';
  }

  async connect(): Promise<void> {
    if (!this.client) {
      const driver = await this.driverLoader();
      this.client = new driver.MongoClient(this.config.url, this.config.options);
    }
    await this.client.connect();
    this.database = this.client.db(this.config.database);
  }

  async disconnect(): Promise<void> {
    if (!this.client || !this.ownsClient) return;
    await this.client.close();
    this.client = null;
    this.database = null;
  }

  async find(options: DocumentQueryOptions<TDocument> = {}): Promise<TDocument[]> {
    const collection = await this.getCollection();
    let cursor = collection.find(toMongoFilter(options.filter));
    const sort = toMongoSort(options);
    if (sort) {
      cursor = cursor.sort(sort);
    }
    if (options.skip !== undefined) {
      cursor = cursor.skip(Math.max(options.skip, 0));
    }
    if (options.limit !== undefined) {
      cursor = cursor.limit(Math.max(options.limit, 0));
    }
    return cursor.toArray();
  }

  async findOne(filter: DocumentFilter<TDocument> = {} as DocumentFilter<TDocument>): Promise<TDocument | null> {
    const collection = await this.getCollection();
    return collection.findOne(toMongoFilter(filter));
  }

  async insert(document: TDocument): Promise<DocumentInsertResult> {
    const collection = await this.getCollection();
    const result = await collection.insertOne(document);
    return { insertedId: normalizeInsertedId(result.insertedId) };
  }

  async update(filter: DocumentFilter<TDocument>, patch: Partial<TDocument>): Promise<DocumentUpdateResult> {
    const collection = await this.getCollection();
    const result = await collection.updateMany(toMongoFilter(filter), { $set: patch });
    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  async delete(filter: DocumentFilter<TDocument>): Promise<DocumentDeleteResult> {
    const collection = await this.getCollection();
    const result = await collection.deleteMany(toMongoFilter(filter));
    return {
      deletedCount: result.deletedCount ?? 0,
    };
  }

  async count(filter: DocumentFilter<TDocument> = {} as DocumentFilter<TDocument>): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments(toMongoFilter(filter));
  }

  private async getCollection() {
    if (!this.database) {
      await this.connect();
    }
    if (!this.database) {
      throw new Error('MongoDBAdapter could not establish a database connection.');
    }
    return this.database.collection<TDocument>(this.collectionName);
  }
}
