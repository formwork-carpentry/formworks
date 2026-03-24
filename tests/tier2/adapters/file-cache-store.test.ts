import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { FileCacheStore } from '../../../src/cache/adapters/FileCacheStore.js';

const TEST_DIR = `/tmp/carpenter-test-cache-${Date.now()}`;

async function cleanup(): Promise<void> {
  await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
}

describe('tier2/adapters/FileCacheStore', () => {
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

  it('handles missing and forgotten keys', async () => {
    expect(await cache.get('missing')).toBeNull();

    await cache.put('temp', 'value');
    expect(await cache.forget('temp')).toBe(true);
    expect(await cache.get('temp')).toBeNull();
  });

  it('checks existence and supports counters', async () => {
    await cache.put('exists', true);
    expect(await cache.has('exists')).toBe(true);
    expect(await cache.has('nope')).toBe(false);

    expect(await cache.increment('counter')).toBe(1);
    expect(await cache.increment('counter')).toBe(2);
    expect(await cache.increment('counter', 5)).toBe(7);
    expect(await cache.decrement('counter', 3)).toBe(4);
  });

  it('supports flush, many and putMany', async () => {
    await cache.put('a', 1);
    await cache.put('b', 2);

    const result = await cache.many(['a', 'b', 'z']);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.get('z')).toBeNull();

    await cache.putMany(new Map([['x', 10], ['y', 20]]));
    expect(await cache.get('x')).toBe(10);
    expect(await cache.get('y')).toBe(20);

    await cache.flush();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('memoizes remember callback and expires ttl', async () => {
    let calls = 0;
    const v1 = await cache.remember('computed', 60, () => {
      calls++;
      return 'result';
    });
    const v2 = await cache.remember('computed', 60, () => {
      calls++;
      return 'result2';
    });

    expect(v1).toBe('result');
    expect(v2).toBe('result');
    expect(calls).toBe(1);

    await cache.put('short', 'value', -1);
    expect(await cache.get('short')).toBeNull();
  });
});
