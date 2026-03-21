import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FilesystemDocumentAdapter } from '../src/FilesystemDocumentAdapter.js';

interface TestDoc extends Record<string, unknown> {
  id?: string;
  name: string;
  age: number;
}

describe('FilesystemDocumentAdapter', () => {
  let filePath: string;
  let adapter: FilesystemDocumentAdapter<TestDoc>;

  beforeEach(async () => {
    filePath = join(tmpdir(), `carpenter-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    adapter = new FilesystemDocumentAdapter<TestDoc>({ file: filePath });
    await adapter.connect();
  });

  afterEach(async () => {
    await adapter.disconnect();
    try { await fs.unlink(filePath); } catch {}
  });

  it('should return driver name', () => {
    expect(adapter.driverName()).toBe('filesystem');
  });

  it('should insert and find documents', async () => {
    const { insertedId } = await adapter.insert({ name: 'Alice', age: 30 });
    expect(insertedId).toBeDefined();
    const docs = await adapter.find();
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe('Alice');
  });

  it('should findOne', async () => {
    await adapter.insert({ name: 'Alice', age: 30 });
    await adapter.insert({ name: 'Bob', age: 25 });
    const doc = await adapter.findOne({ name: 'Bob' });
    expect(doc).not.toBeNull();
    expect(doc!.age).toBe(25);
  });

  it('should return null for findOne with no match', async () => {
    const doc = await adapter.findOne({ name: 'Nobody' });
    expect(doc).toBeNull();
  });

  it('should update documents', async () => {
    await adapter.insert({ name: 'Alice', age: 30 });
    const result = await adapter.update({ name: 'Alice' }, { age: 31 });
    expect(result.matchedCount).toBe(1);
    expect(result.modifiedCount).toBe(1);
    const updated = await adapter.findOne({ name: 'Alice' });
    expect(updated!.age).toBe(31);
  });

  it('should delete documents', async () => {
    await adapter.insert({ name: 'Alice', age: 30 });
    await adapter.insert({ name: 'Bob', age: 25 });
    const result = await adapter.delete({ name: 'Alice' });
    expect(result.deletedCount).toBe(1);
    expect(await adapter.count()).toBe(1);
  });

  it('should count documents', async () => {
    await adapter.insert({ name: 'Alice', age: 30 });
    await adapter.insert({ name: 'Bob', age: 25 });
    expect(await adapter.count()).toBe(2);
    expect(await adapter.count({ name: 'Alice' })).toBe(1);
  });

  it('should find with sort', async () => {
    await adapter.insert({ name: 'Charlie', age: 35 });
    await adapter.insert({ name: 'Alice', age: 30 });
    await adapter.insert({ name: 'Bob', age: 25 });
    const sorted = await adapter.find({ sort: { field: 'name', direction: 'asc' } });
    expect(sorted.map((d) => d.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('should find with skip and limit', async () => {
    await adapter.insert({ name: 'A', age: 1 });
    await adapter.insert({ name: 'B', age: 2 });
    await adapter.insert({ name: 'C', age: 3 });
    const docs = await adapter.find({ skip: 1, limit: 1 });
    expect(docs).toHaveLength(1);
  });

  it('should throw if not connected', async () => {
    const unconnected = new FilesystemDocumentAdapter<TestDoc>({ file: filePath });
    await expect(unconnected.find()).rejects.toThrow('must be connected');
  });
});
