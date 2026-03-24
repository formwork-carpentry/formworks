import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { LocalStorageAdapter } from '../../../src/storage/adapters/LocalStorageAdapter.js';

const TEST_DIR = `/tmp/carpenter-test-storage-${Date.now()}`;

async function cleanup(): Promise<void> {
  await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
}

describe('tier2/adapters/LocalStorageAdapter', () => {
  let storage: LocalStorageAdapter;
  const root = join(TEST_DIR, 'storage');

  beforeEach(async () => {
    storage = new LocalStorageAdapter({ root, baseUrl: 'https://cdn.example.com' });
    await fs.mkdir(root, { recursive: true });
  });

  afterEach(cleanup);

  it('stores and retrieves text files', async () => {
    await storage.put('docs/readme.txt', 'Hello World');
    const content = await storage.getString('docs/readme.txt');
    expect(content).toBe('Hello World');
  });

  it('stores and retrieves binary data', async () => {
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await storage.put('images/logo.png', data);
    const result = await storage.get('images/logo.png');
    expect(Buffer.compare(result, data)).toBe(0);
  });

  it('creates nested directories automatically', async () => {
    await storage.put('a/b/c/deep.txt', 'deep');
    expect(await storage.exists('a/b/c/deep.txt')).toBe(true);
  });

  it('checks file existence and deletion', async () => {
    await storage.put('test.txt', 'data');
    expect(await storage.exists('test.txt')).toBe(true);
    expect(await storage.exists('nope.txt')).toBe(false);
    expect(await storage.delete('test.txt')).toBe(true);
    expect(await storage.delete('ghost.txt')).toBe(false);
  });

  it('copies and moves files', async () => {
    await storage.put('original.txt', 'content');
    await storage.copy('original.txt', 'backup/copy.txt');
    await storage.move('original.txt', 'moved.txt');

    expect(await storage.exists('original.txt')).toBe(false);
    expect(await storage.getString('backup/copy.txt')).toBe('content');
    expect(await storage.getString('moved.txt')).toBe('content');
  });

  it('returns size and modification date', async () => {
    await storage.put('sized.txt', 'hello');
    expect(await storage.size('sized.txt')).toBe(5);

    await storage.put('dated.txt', 'x');
    const mod = await storage.lastModified('dated.txt');
    expect(mod).toBeInstanceOf(Date);
    expect(mod.getTime()).toBeGreaterThan(0);
  });

  it('supports directory operations', async () => {
    await storage.put('docs/a.txt', 'a');
    await storage.put('docs/b.txt', 'b');
    await storage.put('other/c.txt', 'c');

    const files = await storage.files('docs');
    expect(files).toContain('docs/a.txt');
    expect(files).toContain('docs/b.txt');
    expect(files).not.toContain('other/c.txt');

    const all = await storage.allFiles();
    expect(all).toHaveLength(3);

    await storage.makeDirectory('empty-dir');
    expect(await storage.directories()).toContain('empty-dir');
    await storage.deleteDirectory('empty-dir');
    expect(await storage.directories()).not.toContain('empty-dir');
  });

  it('builds url and supports append/prepend', async () => {
    expect(storage.url('images/photo.jpg')).toBe('https://cdn.example.com/images/photo.jpg');

    await storage.put('log.txt', 'line1\n');
    await storage.append('log.txt', 'line2\n');
    expect(await storage.getString('log.txt')).toBe('line1\nline2\n');

    await storage.put('log2.txt', 'line2\n');
    await storage.prepend('log2.txt', 'line1\n');
    expect(await storage.getString('log2.txt')).toBe('line1\nline2\n');
  });
});
