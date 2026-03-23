/**
 * @module @carpentry/storage
 * @description Tests for Storage system (CARP-028)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter } from '../src/adapters/MemoryStorageAdapter.js';
import { StorageManager, setStorageManager, Storage } from '../src/manager/StorageManager.js';

describe('CARP-028: MemoryStorageAdapter', () => {
  let disk: MemoryStorageAdapter;

  beforeEach(() => { disk = new MemoryStorageAdapter(); });

  it('put + get a file', async () => {
    await disk.put('docs/readme.txt', 'Hello World');
    const content = await disk.get('docs/readme.txt');
    expect(content!.toString('utf-8')).toBe('Hello World');
  });

  it('put returns normalized path', async () => {
    const path = await disk.put('/uploads/file.jpg', Buffer.from('img'));
    expect(path).toBe('uploads/file.jpg');
  });

  it('get returns null for missing file', async () => {
    expect(await disk.get('nope.txt')).toBeNull();
  });

  it('exists()', async () => {
    await disk.put('a.txt', 'content');
    expect(await disk.exists('a.txt')).toBe(true);
    expect(await disk.exists('b.txt')).toBe(false);
  });

  it('delete()', async () => {
    await disk.put('a.txt', 'content');
    expect(await disk.delete('a.txt')).toBe(true);
    expect(await disk.exists('a.txt')).toBe(false);
    expect(await disk.delete('a.txt')).toBe(false);
  });

  it('url()', () => {
    const d = new MemoryStorageAdapter('https://cdn.example.com');
    expect(d.url('images/logo.png')).toBe('https://cdn.example.com/images/logo.png');
  });

  it('temporaryUrl()', async () => {
    await disk.put('secret.pdf', 'data');
    const url = await disk.temporaryUrl('secret.pdf', 3600);
    expect(url).toContain('secret.pdf');
    expect(url).toContain('token=');
  });

  it('copy()', async () => {
    await disk.put('original.txt', 'data');
    await disk.copy('original.txt', 'copy.txt');
    expect(await disk.exists('original.txt')).toBe(true);
    expect(await disk.exists('copy.txt')).toBe(true);
    await disk.assertContent('copy.txt', 'data');
  });

  it('move()', async () => {
    await disk.put('old.txt', 'data');
    await disk.move('old.txt', 'new.txt');
    expect(await disk.exists('old.txt')).toBe(false);
    expect(await disk.exists('new.txt')).toBe(true);
  });

  it('list()', async () => {
    await disk.put('uploads/a.txt', 'a');
    await disk.put('uploads/b.txt', 'b');
    await disk.put('other/c.txt', 'c');

    const all = await disk.list();
    expect(all).toHaveLength(3);

    const uploads = await disk.list('uploads');
    expect(uploads).toHaveLength(2);
  });

  it('size()', async () => {
    await disk.put('file.txt', 'hello');
    expect(await disk.size('file.txt')).toBe(5);
  });

  it('mimeType()', async () => {
    await disk.put('file.txt', 'hello', { contentType: 'text/plain' });
    expect(await disk.mimeType('file.txt')).toBe('text/plain');
  });

  it('lastModified()', async () => {
    await disk.put('file.txt', 'hello');
    const date = await disk.lastModified('file.txt');
    expect(date).toBeInstanceOf(Date);
  });

  it('assertExists / assertMissing', async () => {
    await disk.put('present.txt', 'yes');
    disk.assertExists('present.txt');
    disk.assertMissing('absent.txt');
    expect(() => disk.assertExists('absent.txt')).toThrow();
    expect(() => disk.assertMissing('present.txt')).toThrow();
  });

  it('reset()', async () => {
    await disk.put('a.txt', 'a');
    await disk.put('b.txt', 'b');
    disk.reset();
    expect(disk.fileCount()).toBe(0);
  });
});

describe('CARP-028: StorageManager', () => {
  let manager: StorageManager;

  beforeEach(() => {
    manager = new StorageManager('memory', { memory: { driver: 'memory' } });
  });

  it('proxies to default disk', async () => {
    await manager.put('test.txt', 'hello');
    expect((await manager.get('test.txt'))!.toString()).toBe('hello');
  });

  it('resolves named disks', () => {
    const d = manager.disk('memory');
    expect(d).toBeDefined();
    expect(manager.disk('memory')).toBe(d); // cached
  });

  it('throws on unknown driver', () => {
    expect(() => manager.disk('s3')).toThrow('not configured');
  });

  it('registers custom driver', async () => {
    manager.registerDriver('custom', () => new MemoryStorageAdapter('https://custom'));
    const d = manager.disk('custom');
    expect(d.url('file.txt')).toContain('custom');
  });
});

describe('CARP-028: Storage Facade', () => {
  beforeEach(() => { setStorageManager(new StorageManager()); });

  it('put + get', async () => {
    await Storage.put('key.txt', 'val');
    const buf = await Storage.get('key.txt');
    expect(buf!.toString()).toBe('val');
  });

  it('exists + delete', async () => {
    await Storage.put('x.txt', '1');
    expect(await Storage.exists('x.txt')).toBe(true);
    await Storage.delete('x.txt');
    expect(await Storage.exists('x.txt')).toBe(false);
  });

  it('disk() returns named disk', () => {
    expect(Storage.disk('memory')).toBeDefined();
  });
});
