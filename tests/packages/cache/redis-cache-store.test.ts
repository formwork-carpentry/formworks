import { describe, it, expect, beforeEach } from 'vitest';
import { RedisCacheStore, MockRedisClient } from '../../../packages/cache-redis/src/index.js';

describe('packages/cache/RedisCacheStore', () => {
  let redis: MockRedisClient;
  let cache: RedisCacheStore;

  beforeEach(() => {
    redis = new MockRedisClient();
    cache = new RedisCacheStore(redis, { prefix: 'test:' });
  });

  it('stores and retrieves values (JSON serialized)', async () => {
    await cache.put('user', { name: 'Alice', age: 30 });
    expect(await cache.get('user')).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns null for missing keys', async () => {
    expect(await cache.get('missing')).toBeNull();
  });

  it('forgets a key', async () => {
    await cache.put('key', 'val');
    expect(await cache.forget('key')).toBe(true);
    expect(await cache.get('key')).toBeNull();
  });

  it('supports increment/decrement and many/putMany', async () => {
    expect(await cache.increment('counter')).toBe(1);
    expect(await cache.increment('counter', 5)).toBe(6);
    expect(await cache.decrement('counter', 2)).toBe(4);

    await cache.putMany(new Map([['x', 10], ['y', 20]]));
    const result = await cache.many(['x', 'y', 'z']);
    expect(result.get('x')).toBe(10);
    expect(result.get('y')).toBe(20);
    expect(result.get('z')).toBeNull();
  });

  it('remembers computed values once and flushes prefixed keys', async () => {
    let calls = 0;
    const first = await cache.remember('computed', 60, () => {
      calls++;
      return 'result';
    });
    const second = await cache.remember('computed', 60, () => {
      calls++;
      return 'other';
    });

    expect(first).toBe('result');
    expect(second).toBe('result');
    expect(calls).toBe(1);

    await cache.put('a', 1);
    await cache.put('b', 2);
    await cache.flush();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
    expect(cache.getPrefix()).toBe('test:');
  });
});
