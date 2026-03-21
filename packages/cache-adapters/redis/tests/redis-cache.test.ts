import { describe, it, expect, beforeEach } from 'vitest';
import { RedisCacheStore, MockRedisClient } from '../src/index.js';

describe('RedisCacheStore', () => {
  let mock: MockRedisClient;
  let cache: RedisCacheStore;

  beforeEach(() => {
    mock = new MockRedisClient();
    cache = new RedisCacheStore(mock, { prefix: 'test:' });
  });

  it('should put and get a value', async () => {
    await cache.put('key', { name: 'Alice' });
    const result = await cache.get<{ name: string }>('key');
    expect(result).toEqual({ name: 'Alice' });
  });

  it('should return null for missing key', async () => {
    expect(await cache.get('missing')).toBeNull();
  });

  it('should put with TTL', async () => {
    await cache.put('ttl-key', 'value', 60);
    expect(await cache.get('ttl-key')).toBe('value');
  });

  it('should forget a key', async () => {
    await cache.put('key', 'value');
    const deleted = await cache.forget('key');
    expect(deleted).toBe(true);
    expect(await cache.get('key')).toBeNull();
  });

  it('should return false when forgetting missing key', async () => {
    expect(await cache.forget('nope')).toBe(false);
  });

  it('should check if key exists', async () => {
    await cache.put('key', 'value');
    expect(await cache.has('key')).toBe(true);
    expect(await cache.has('missing')).toBe(false);
  });

  it('should flush all entries', async () => {
    await cache.put('a', 1);
    await cache.put('b', 2);
    await cache.flush();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('should increment and decrement', async () => {
    const inc = await cache.increment('counter', 5);
    expect(inc).toBe(5);
    const dec = await cache.decrement('counter', 2);
    expect(dec).toBe(3);
  });

  it('should get many keys at once', async () => {
    await cache.put('a', 'one');
    await cache.put('b', 'two');
    const result = await cache.many<string>(['a', 'b', 'c']);
    expect(result.get('a')).toBe('one');
    expect(result.get('b')).toBe('two');
    expect(result.get('c')).toBeNull();
  });

  it('should put many entries', async () => {
    await cache.putMany(new Map([['x', 10], ['y', 20]]));
    expect(await cache.get('x')).toBe(10);
    expect(await cache.get('y')).toBe(20);
  });

  it('should remember a value', async () => {
    let calls = 0;
    const value = await cache.remember('key', 60, () => { calls++; return 'computed'; });
    expect(value).toBe('computed');
    expect(calls).toBe(1);

    const cached = await cache.remember('key', 60, () => { calls++; return 'nope'; });
    expect(cached).toBe('computed');
    expect(calls).toBe(1);
  });

  it('should use configured prefix', () => {
    expect(cache.getPrefix()).toBe('test:');
  });

  it('should use default prefix', () => {
    const defaultCache = new RedisCacheStore(mock);
    expect(defaultCache.getPrefix()).toBe('carpenter_cache:');
  });
});
