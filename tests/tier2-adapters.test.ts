/**
 * @module tests
 * @description Tests for Tier 2 real adapters: filesystem storage, file cache, file sessions, tenant scope
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { LocalStorageAdapter } from '../src/storage/adapters/LocalStorageAdapter.js';
import { FileCacheStore } from '../src/cache/adapters/FileCacheStore.js';
import { FileSessionStore } from '../src/session/FileSessionStore.js';
import { TenantScope, TenantCacheScope, TenantStorageScope } from '../src/tenancy/scope.js';
import { MemoryCacheStore } from '../src/cache/adapters/MemoryCacheStore.js';
import type { Tenant } from '../src/tenancy/types.js';

const TEST_DIR = '/tmp/carpenter-test-' + Date.now();

async function cleanup(): Promise<void> {
  await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════
// LOCAL STORAGE ADAPTER
// ═══════════════════════════════════════════════════════════

describe('LocalStorageAdapter', () => {
  let storage: LocalStorageAdapter;
  const root = join(TEST_DIR, 'storage');

  beforeEach(async () => {
    storage = new LocalStorageAdapter({ root, baseUrl: 'https://cdn.example.com' });
    await fs.mkdir(root, { recursive: true });
  });

  afterEach(cleanup);

  describe('put and get', () => {
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
  });

  describe('exists', () => {
    it('returns true for existing files', async () => {
      await storage.put('test.txt', 'data');
      expect(await storage.exists('test.txt')).toBe(true);
    });

    it('returns false for missing files', async () => {
      expect(await storage.exists('nope.txt')).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes a file', async () => {
      await storage.put('temp.txt', 'temp');
      expect(await storage.delete('temp.txt')).toBe(true);
      expect(await storage.exists('temp.txt')).toBe(false);
    });

    it('returns false for missing file', async () => {
      expect(await storage.delete('ghost.txt')).toBe(false);
    });
  });

  describe('copy and move', () => {
    it('copies a file', async () => {
      await storage.put('original.txt', 'content');
      await storage.copy('original.txt', 'backup/copy.txt');
      expect(await storage.getString('original.txt')).toBe('content');
      expect(await storage.getString('backup/copy.txt')).toBe('content');
    });

    it('moves a file', async () => {
      await storage.put('old.txt', 'data');
      await storage.move('old.txt', 'new.txt');
      expect(await storage.exists('old.txt')).toBe(false);
      expect(await storage.getString('new.txt')).toBe('data');
    });
  });

  describe('size and lastModified', () => {
    it('returns file size', async () => {
      await storage.put('sized.txt', 'hello');
      expect(await storage.size('sized.txt')).toBe(5);
    });

    it('returns last modified date', async () => {
      await storage.put('dated.txt', 'x');
      const mod = await storage.lastModified('dated.txt');
      expect(mod).toBeInstanceOf(Date);
      expect(mod.getTime()).toBeGreaterThan(0);
    });
  });

  describe('directory operations', () => {
    it('lists files in a directory', async () => {
      await storage.put('docs/a.txt', 'a');
      await storage.put('docs/b.txt', 'b');
      await storage.put('other/c.txt', 'c');
      const files = await storage.files('docs');
      expect(files).toContain('docs/a.txt');
      expect(files).toContain('docs/b.txt');
      expect(files).not.toContain('other/c.txt');
    });

    it('lists all files recursively', async () => {
      await storage.put('a.txt', 'a');
      await storage.put('sub/b.txt', 'b');
      await storage.put('sub/deep/c.txt', 'c');
      const all = await storage.allFiles();
      expect(all).toHaveLength(3);
    });

    it('lists subdirectories', async () => {
      await storage.put('alpha/file.txt', 'x');
      await storage.put('beta/file.txt', 'x');
      const dirs = await storage.directories();
      expect(dirs).toContain('alpha');
      expect(dirs).toContain('beta');
    });

    it('creates and deletes directories', async () => {
      await storage.makeDirectory('empty-dir');
      const dirs = await storage.directories();
      expect(dirs).toContain('empty-dir');

      await storage.deleteDirectory('empty-dir');
      const after = await storage.directories();
      expect(after).not.toContain('empty-dir');
    });
  });

  describe('url', () => {
    it('generates public URL', () => {
      expect(storage.url('images/photo.jpg')).toBe('https://cdn.example.com/images/photo.jpg');
    });
  });

  describe('append and prepend', () => {
    it('appends to a file', async () => {
      await storage.put('log.txt', 'line1\n');
      await storage.append('log.txt', 'line2\n');
      expect(await storage.getString('log.txt')).toBe('line1\nline2\n');
    });

    it('prepends to a file', async () => {
      await storage.put('log.txt', 'line2\n');
      await storage.prepend('log.txt', 'line1\n');
      expect(await storage.getString('log.txt')).toBe('line1\nline2\n');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// FILE CACHE STORE
// ═══════════════════════════════════════════════════════════

describe('FileCacheStore', () => {
  let cache: FileCacheStore;
  const dir = join(TEST_DIR, 'cache');

  beforeEach(async () => {
    cache = new FileCacheStore({ directory: dir });
    await fs.mkdir(dir, { recursive: true });
  });

  afterEach(cleanup);

  it('stores and retrieves values', async () => {
    await cache.put('key1', { name: 'Alice', age: 30 });
    expect(await cache.get('key1')).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns null for missing keys', async () => {
    expect(await cache.get('missing')).toBeNull();
  });

  it('forgets a key', async () => {
    await cache.put('temp', 'value');
    expect(await cache.forget('temp')).toBe(true);
    expect(await cache.get('temp')).toBeNull();
  });

  it('has() checks existence', async () => {
    await cache.put('exists', true);
    expect(await cache.has('exists')).toBe(true);
    expect(await cache.has('nope')).toBe(false);
  });

  it('increments and decrements', async () => {
    expect(await cache.increment('counter')).toBe(1);
    expect(await cache.increment('counter')).toBe(2);
    expect(await cache.increment('counter', 5)).toBe(7);
    expect(await cache.decrement('counter', 3)).toBe(4);
  });

  it('flushes all entries', async () => {
    await cache.put('a', 1);
    await cache.put('b', 2);
    await cache.flush();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('many() retrieves multiple keys', async () => {
    await cache.put('x', 10);
    await cache.put('y', 20);
    const result = await cache.many(['x', 'y', 'z']);
    expect(result.get('x')).toBe(10);
    expect(result.get('y')).toBe(20);
    expect(result.get('z')).toBeNull();
  });

  it('putMany() stores multiple entries', async () => {
    await cache.putMany(new Map([['a', 1], ['b', 2]]));
    expect(await cache.get('a')).toBe(1);
    expect(await cache.get('b')).toBe(2);
  });

  it('remember() caches callback result', async () => {
    let calls = 0;
    const v1 = await cache.remember('computed', 60, () => { calls++; return 'result'; });
    const v2 = await cache.remember('computed', 60, () => { calls++; return 'result2'; });
    expect(v1).toBe('result');
    expect(v2).toBe('result');
    expect(calls).toBe(1);
  });

  it('respects TTL expiration', async () => {
    await cache.put('short', 'value', -1); // Already expired
    expect(await cache.get('short')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// FILE SESSION STORE
// ═══════════════════════════════════════════════════════════

describe('FileSessionStore', () => {
  let store: FileSessionStore;
  const dir = join(TEST_DIR, 'sessions');

  beforeEach(async () => {
    store = new FileSessionStore({ directory: dir, sessionId: 'test-session-123' });
    await fs.mkdir(dir, { recursive: true });
  });

  afterEach(cleanup);

  it('stores and retrieves values', async () => {
    await store.put('user_id', 42);
    expect(await store.get<number>('user_id')).toBe(42);
  });

  it('returns null for missing keys', async () => {
    expect(await store.get('nope')).toBeNull();
  });

  it('forgets a key', async () => {
    await store.put('temp', 'val');
    await store.forget('temp');
    expect(await store.get('temp')).toBeNull();
  });

  it('flushes all data', async () => {
    await store.put('a', 1);
    await store.put('b', 2);
    await store.flush();
    expect(await store.get('a')).toBeNull();
  });

  it('provides a session ID', () => {
    expect(store.getSessionId()).toBe('test-session-123');
  });

  it('regenerates session ID', async () => {
    await store.put('preserved', 'data');
    const newId = await store.regenerate();
    expect(newId).not.toBe('test-session-123');
    expect(store.getSessionId()).toBe(newId);
    // Data should persist across regeneration
    expect(await store.get('preserved')).toBe('data');
  });

  it('persists data to disk', async () => {
    await store.put('persistent', 'value');

    // Create a new store with the same session ID
    const store2 = new FileSessionStore({ directory: dir, sessionId: 'test-session-123' });
    expect(await store2.get('persistent')).toBe('value');
  });

  it('garbage collects expired sessions', async () => {
    // Create a store with very short TTL
    const expired = new FileSessionStore({ directory: dir, sessionId: 'expired', ttlMinutes: 0 });
    await expired.put('old', 'data');

    // Manually corrupt the file to have old timestamp
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const path = join(dir, file);
        const raw = await fs.readFile(path, 'utf-8');
        const data = JSON.parse(raw);
        data.lastAccessed = 0; // epoch = definitely expired
        await fs.writeFile(path, JSON.stringify(data));
      }
    }

    const cleaned = await store.gc();
    expect(cleaned).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// TENANT SCOPE
// ═══════════════════════════════════════════════════════════

describe('TenantScope', () => {
  const tenant: Tenant = { id: 'acme', name: 'Acme Corp', slug: 'acme', domain: 'acme.example.com', status: 'active' as const };

  describe('TenantScope (query)', () => {
    it('applies tenant WHERE clause', () => {
      const scope = new TenantScope(tenant, 'tenant_id');
      const fakeQb = {
        clauses: [] as Array<{ col: string; val: unknown }>,
        where(col: string, val: unknown) { this.clauses.push({ col, val }); return this; },
      };

      scope.apply(fakeQb);
      expect(fakeQb.clauses).toHaveLength(1);
      expect(fakeQb.clauses[0]).toEqual({ col: 'tenant_id', val: 'acme' });
    });

    it('uses custom column name', () => {
      const scope = new TenantScope(tenant, 'org_id');
      expect(scope.getColumn()).toBe('org_id');
    });

    it('returns tenant ID', () => {
      const scope = new TenantScope(tenant);
      expect(scope.getTenantId()).toBe('acme');
    });
  });

  describe('TenantCacheScope', () => {
    let innerStore: MemoryCacheStore;

    beforeEach(() => {
      innerStore = new MemoryCacheStore();
    });

    it('prefixes keys with tenant ID', async () => {
      const scoped = new TenantCacheScope(innerStore, tenant);
      await scoped.put('users', ['alice', 'bob']);

      // Raw store has prefixed key
      expect(await innerStore.get('tenant_acme:users')).toEqual(['alice', 'bob']);
      // Scoped read works
      expect(await scoped.get('users')).toEqual(['alice', 'bob']);
    });

    it('forget removes prefixed key', async () => {
      const scoped = new TenantCacheScope(innerStore, tenant);
      await scoped.put('temp', 'value');
      await scoped.forget('temp');
      expect(await innerStore.get('tenant_acme:temp')).toBeNull();
    });

    it('has checks prefixed key', async () => {
      const scoped = new TenantCacheScope(innerStore, tenant);
      await scoped.put('exists', true);
      expect(await scoped.has('exists')).toBe(true);
      expect(await scoped.has('nope')).toBe(false);
    });

    it('isolates tenants from each other', async () => {
      const tenant2: Tenant = { id: 'beta', name: 'Beta Inc', slug: 'beta', domain: '', status: 'active' as const };
      const scopeA = new TenantCacheScope(innerStore, tenant);
      const scopeB = new TenantCacheScope(innerStore, tenant2);

      await scopeA.put('data', 'acme-data');
      await scopeB.put('data', 'beta-data');

      expect(await scopeA.get('data')).toBe('acme-data');
      expect(await scopeB.get('data')).toBe('beta-data');
    });

    it('returns correct prefix', () => {
      const scoped = new TenantCacheScope(innerStore, tenant);
      expect(scoped.getPrefix()).toBe('tenant_acme:');
    });
  });

  describe('TenantStorageScope', () => {
    it('prefixes paths with tenant directory', async () => {
      const paths: string[] = [];
      const mockStorage = {
        async put(path: string, _content: Buffer | string) { paths.push(path); },
        async get(path: string) { paths.push(path); return Buffer.from(''); },
        async exists(path: string) { paths.push(path); return true; },
        async delete(path: string) { paths.push(path); return true; },
      };

      const scoped = new TenantStorageScope(mockStorage, tenant);
      await scoped.put('avatars/photo.png', 'data');
      await scoped.get('docs/report.pdf');
      await scoped.exists('config.json');
      await scoped.delete('temp.txt');

      expect(paths).toEqual([
        'tenants/acme/avatars/photo.png',
        'tenants/acme/docs/report.pdf',
        'tenants/acme/config.json',
        'tenants/acme/temp.txt',
      ]);
    });

    it('returns correct prefix', () => {
      const scoped = new TenantStorageScope({ put: async () => {}, get: async () => Buffer.from(''), exists: async () => false, delete: async () => false }, tenant);
      expect(scoped.getPrefix()).toBe('tenants/acme/');
    });
  });
});
