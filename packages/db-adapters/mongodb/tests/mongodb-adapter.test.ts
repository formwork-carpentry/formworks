import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MongoDBAdapter } from '../src/mongoDBAdapter.js';
import type { IMongoClient, IMongoDatabase, IMongoCollection, IMongoCursor } from '../src/types.js';

function createMockCursor(docs: Record<string, unknown>[] = []): IMongoCursor {
  let _docs = [...docs];
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(_docs),
  };
}

function createMockCollection(docs: Record<string, unknown>[] = []): IMongoCollection {
  return {
    find: vi.fn().mockReturnValue(createMockCursor(docs)),
    findOne: vi.fn().mockResolvedValue(docs[0] ?? null),
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'abc123' }),
    updateMany: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(docs.length),
  };
}

function createMockClient(docs: Record<string, unknown>[] = []): IMongoClient {
  const collection = createMockCollection(docs);
  const database: IMongoDatabase = {
    collection: vi.fn().mockReturnValue(collection),
  };
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    db: vi.fn().mockReturnValue(database),
  };
}

describe('MongoDBAdapter', () => {
  const docs = [{ _id: '1', name: 'Alice' }, { _id: '2', name: 'Bob' }];
  let client: ReturnType<typeof createMockClient>;
  let adapter: MongoDBAdapter;

  beforeEach(() => {
    client = createMockClient(docs);
    adapter = new MongoDBAdapter(
      { url: 'mongodb://localhost:27017', database: 'testdb', collection: 'users' },
      { client },
    );
  });

  it('should return driver name', () => {
    expect(adapter.driverName()).toBe('mongodb');
  });

  it('should connect and use database', async () => {
    await adapter.connect();
    expect(client.connect).toHaveBeenCalled();
    expect(client.db).toHaveBeenCalledWith('testdb');
  });

  it('should find documents', async () => {
    await adapter.connect();
    const results = await adapter.find();
    expect(results).toEqual(docs);
  });

  it('should find with sort, skip, limit', async () => {
    await adapter.connect();
    await adapter.find({ sort: { field: 'name', direction: 'asc' }, skip: 0, limit: 10 });
    const db = client.db('testdb');
    const collection = db.collection('users');
    expect(collection.find).toHaveBeenCalled();
  });

  it('should findOne', async () => {
    await adapter.connect();
    const result = await adapter.findOne({ name: 'Alice' } as Record<string, unknown>);
    expect(result).toEqual(docs[0]);
  });

  it('should insert a document', async () => {
    await adapter.connect();
    const result = await adapter.insert({ name: 'Carol' } as Record<string, unknown>);
    expect(result.insertedId).toBe('abc123');
  });

  it('should update documents', async () => {
    await adapter.connect();
    const result = await adapter.update({ name: 'Alice' } as Record<string, unknown>, { name: 'Alicia' });
    expect(result.modifiedCount).toBe(1);
  });

  it('should delete documents', async () => {
    await adapter.connect();
    const result = await adapter.delete({ name: 'Bob' } as Record<string, unknown>);
    expect(result.deletedCount).toBe(1);
  });

  it('should count documents', async () => {
    await adapter.connect();
    const count = await adapter.count();
    expect(count).toBe(2);
  });

  it('should disconnect', async () => {
    await adapter.connect();
    await adapter.disconnect();
    // client not owned, so close not called
    expect(client.close).not.toHaveBeenCalled();
  });
});
