/**
 * @module @carpentry/cache
 * @description Tests for Cache system (CARP-025)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryCacheStore } from '../src/adapters/MemoryCacheStore.js';
import { NullCacheStore } from '../src/adapters/NullCacheStore.js';
import { CacheManager, setCacheManager, Cache } from '../src/manager/CacheManager.js';

// ── MemoryCacheStore ──────────────────────────────────────

describe('CARP-025: MemoryCacheStore', () => {
  let cache: MemoryCacheStore;

  beforeEach(() => {
    cache = new MemoryCacheStore();
  });

  describe('get / put', () => {
    it('stores and retrieves a value', async () => {
      await cache.put('name', 'Alice');
      expect(await cache.get('name')).toBe('Alice');
    });

    it('stores objects', async () => {
      await cache.put('user', { id: 1, name: 'Alice' });
      expect(await cache.get('user')).toEqual({ id: 1, name: 'Alice' });
    });

    it('returns null for missing keys', async () => {
      expect(await cache.get('nonexistent')).toBeNull();
    });

    it('overwrites existing values', async () => {
      await cache.put('key', 'old');
      await cache.put('key', 'new');
      expect(await cache.get('key')).toBe('new');
    });
  });

  describe('TTL (time-to-live)', () => {
    it('returns value before expiry', async () => {
      await cache.put('key', 'value', 60);
      expect(await cache.get('key')).toBe('value');
    });

    it('returns null after TTL expires', async () => {
      vi.useFakeTimers();
      try {
        await cache.put('key', 'value', 1); // 1 second TTL
        expect(await cache.get('key')).toBe('value');

        vi.advanceTimersByTime(1500); // advance 1.5s
        expect(await cache.get('key')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('no TTL means no expiry', async () => {
      vi.useFakeTimers();
      try {
        await cache.put('key', 'forever');
        vi.advanceTimersByTime(999999999);
        expect(await cache.get('key')).toBe('forever');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('forget / flush', () => {
    it('forget() removes a single key', async () => {
      await cache.put('a', 1);
      await cache.put('b', 2);
      expect(await cache.forget('a')).toBe(true);
      expect(await cache.get('a')).toBeNull();
      expect(await cache.get('b')).toBe(2);
    });

    it('forget() returns false for missing key', async () => {
      expect(await cache.forget('nonexistent')).toBe(false);
    });

    it('flush() clears everything', async () => {
      await cache.put('a', 1);
      await cache.put('b', 2);
      await cache.flush();
      expect(await cache.get('a')).toBeNull();
      expect(await cache.get('b')).toBeNull();
      expect(cache.size()).toBe(0);
    });
  });

  describe('has()', () => {
    it('returns true for existing key', async () => {
      await cache.put('key', 'val');
      expect(await cache.has('key')).toBe(true);
    });

    it('returns false for missing key', async () => {
      expect(await cache.has('nope')).toBe(false);
    });

    it('returns false for expired key', async () => {
      vi.useFakeTimers();
      try {
        await cache.put('key', 'val', 1);
        vi.advanceTimersByTime(2000);
        expect(await cache.has('key')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('increment / decrement', () => {
    it('increment() creates key if missing', async () => {
      const val = await cache.increment('counter');
      expect(val).toBe(1);
    });

    it('increment() adds to existing value', async () => {
      await cache.put('counter', 5);
      expect(await cache.increment('counter')).toBe(6);
      expect(await cache.increment('counter', 10)).toBe(16);
    });

    it('decrement() subtracts', async () => {
      await cache.put('counter', 10);
      expect(await cache.decrement('counter')).toBe(9);
      expect(await cache.decrement('counter', 5)).toBe(4);
    });
  });

  describe('many / putMany', () => {
    it('putMany() stores multiple keys', async () => {
      await cache.putMany(new Map([['a', 1], ['b', 2], ['c', 3]]));
      expect(await cache.get('a')).toBe(1);
      expect(await cache.get('b')).toBe(2);
      expect(await cache.get('c')).toBe(3);
    });

    it('many() retrieves multiple keys', async () => {
      await cache.put('a', 1);
      await cache.put('c', 3);
      const result = await cache.many(['a', 'b', 'c']);
      expect(result.get('a')).toBe(1);
      expect(result.get('b')).toBeNull();
      expect(result.get('c')).toBe(3);
    });
  });

  describe('remember()', () => {
    it('returns cached value on hit', async () => {
      await cache.put('key', 'cached');
      let called = false;
      const val = await cache.remember('key', 60, () => { called = true; return 'fresh'; });
      expect(val).toBe('cached');
      expect(called).toBe(false);
    });

    it('computes and stores on miss', async () => {
      let calls = 0;
      const val = await cache.remember('key', 60, () => { calls++; return 'computed'; });
      expect(val).toBe('computed');
      expect(calls).toBe(1);

      // Second call should hit cache
      const val2 = await cache.remember('key', 60, () => { calls++; return 'recomputed'; });
      expect(val2).toBe('computed');
      expect(calls).toBe(1); // callback NOT called again
    });

    it('supports async callback', async () => {
      const val = await cache.remember('key', 60, async () => {
        return 'async-value';
      });
      expect(val).toBe('async-value');
    });
  });

  describe('size()', () => {
    it('returns count of non-expired entries', async () => {
      await cache.put('a', 1);
      await cache.put('b', 2);
      expect(cache.size()).toBe(2);
    });
  });
});

// ── NullCacheStore ────────────────────────────────────────

describe('CARP-025: NullCacheStore', () => {
  let cache: NullCacheStore;

  beforeEach(() => {
    cache = new NullCacheStore();
  });

  it('always returns null on get', async () => {
    await cache.put('key', 'value');
    expect(await cache.get('key')).toBeNull();
  });

  it('has() always false', async () => {
    await cache.put('key', 'value');
    expect(await cache.has('key')).toBe(false);
  });

  it('remember() always calls callback', async () => {
    let calls = 0;
    await cache.remember('key', 60, () => { calls++; return 'val'; });
    await cache.remember('key', 60, () => { calls++; return 'val'; });
    expect(calls).toBe(2); // called every time, no caching
  });

  it('increment returns 0', async () => {
    expect(await cache.increment('x')).toBe(0);
  });
});

// ── CacheManager ──────────────────────────────────────────

describe('CARP-025: CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    manager = new CacheManager('memory', {
      memory: { driver: 'memory' },
      'null': { driver: 'null' },
    });
  });

  describe('store resolution', () => {
    it('resolves default store', async () => {
      await manager.put('key', 'value');
      expect(await manager.get('key')).toBe('value');
    });

    it('resolves named store', async () => {
      const nullStore = manager.store('null');
      await nullStore.put('key', 'value');
      expect(await nullStore.get('key')).toBeNull(); // it's a NullCacheStore
    });

    it('caches resolved stores (same instance)', () => {
      const a = manager.store('memory');
      const b = manager.store('memory');
      expect(a).toBe(b);
    });

    it('throws for unknown driver', () => {
      expect(() => manager.store('redis')).toThrow('not configured');
    });
  });

  describe('custom driver registration', () => {
    it('registers and uses a custom driver', async () => {
      manager.registerDriver('custom', () => new MemoryCacheStore());
      const store = manager.store('custom');
      await store.put('key', 'custom-value');
      expect(await store.get('key')).toBe('custom-value');
    });
  });

  describe('proxies to default store', () => {
    it('get/put/forget/has all proxy', async () => {
      await manager.put('x', 42);
      expect(await manager.has('x')).toBe(true);
      expect(await manager.get('x')).toBe(42);
      await manager.forget('x');
      expect(await manager.has('x')).toBe(false);
    });

    it('remember() proxies', async () => {
      const val = await manager.remember('key', 60, () => 'computed');
      expect(val).toBe('computed');
      expect(await manager.get('key')).toBe('computed');
    });
  });
});

// ── Cache Facade ──────────────────────────────────────────

describe('CARP-025: Cache Facade', () => {
  beforeEach(() => {
    setCacheManager(new CacheManager());
  });

  it('Cache.put and Cache.get work', async () => {
    await Cache.put('key', 'value');
    expect(await Cache.get('key')).toBe('value');
  });

  it('Cache.remember works', async () => {
    const val = await Cache.remember('k', 60, () => 'hello');
    expect(val).toBe('hello');
  });

  it('Cache.store() returns named store', async () => {
    const store = Cache.store('memory');
    await store.put('a', 1);
    expect(await store.get('a')).toBe(1);
  });
});
