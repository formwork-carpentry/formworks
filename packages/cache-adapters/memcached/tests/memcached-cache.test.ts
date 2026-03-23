import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemcachedCacheStore } from '../src/index.js';

describe('@carpentry/cache-memcached: MemcachedCacheStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', async () => {
    const cache = new MemcachedCacheStore({ servers: 'cache-1:11211', prefix: 'app:' });

    await cache.put('user:1', { name: 'Alice' }, 60);
    expect(await cache.has('user:1')).toBe(true);
    expect(await cache.get<{ name: string }>('user:1')).toEqual({ name: 'Alice' });
  });

  it('expires values by ttl', async () => {
    const cache = new MemcachedCacheStore({ servers: 'cache-2:11211' });

    await cache.put('temp', 'value', 5);
    vi.advanceTimersByTime(4_999);
    expect(await cache.get('temp')).toBe('value');

    vi.advanceTimersByTime(1);
    expect(await cache.get('temp')).toBeNull();
  });

  it('supports increment and decrement', async () => {
    const cache = new MemcachedCacheStore({ servers: 'cache-3:11211' });

    expect(await cache.increment('counter')).toBe(1);
    expect(await cache.increment('counter', 4)).toBe(5);
    expect(await cache.decrement('counter', 2)).toBe(3);
    expect(await cache.decrement('counter', 99)).toBe(0);
  });

  it('supports many, putMany, remember and flush', async () => {
    const cache = new MemcachedCacheStore({ servers: 'cache-4:11211', defaultTtl: 60 });

    await cache.putMany(new Map([
      ['a', 1],
      ['b', 2],
    ]));

    const many = await cache.many<number>(['a', 'b', 'c']);
    expect(many.get('a')).toBe(1);
    expect(many.get('b')).toBe(2);
    expect(many.get('c')).toBeNull();

    let computedCount = 0;
    const first = await cache.remember('memo', 30, async () => {
      computedCount += 1;
      return 'computed';
    });
    const second = await cache.remember('memo', 30, () => {
      computedCount += 1;
      return 'again';
    });

    expect(first).toBe('computed');
    expect(second).toBe('computed');
    expect(computedCount).toBe(1);

    await cache.flush();
    expect(await cache.has('a')).toBe(false);
    expect(await cache.has('memo')).toBe(false);
  });
});
