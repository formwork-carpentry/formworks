/**
 * @module @formwork/cache
 * @description Tests for TaggedCache and cache.tags() functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCacheStore } from '../src/adapters/MemoryCacheStore.js';
import { TaggedCache } from '../src/TaggedCache.js';

describe('TaggedCache', () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  describe('tags() on MemoryCacheStore', () => {
    it('returns a TaggedCache instance', () => {
      const tagged = store.tags(['posts']);
      expect(tagged).toBeInstanceOf(TaggedCache);
    });
  });

  describe('put and get', () => {
    it('stores and retrieves values', async () => {
      const tagged = store.tags(['posts']);
      await tagged.put('latest-posts', [1, 2, 3]);
      expect(await tagged.get('latest-posts')).toEqual([1, 2, 3]);
    });

    it('values are also accessible from the underlying store', async () => {
      await store.tags(['posts']).put('post:1', { title: 'Hello' });
      expect(await store.get('post:1')).toEqual({ title: 'Hello' });
    });

    it('supports TTL', async () => {
      await store.tags(['posts']).put('temp', 'value', 60);
      expect(await store.has('temp')).toBe(true);
    });
  });

  describe('flush by tag', () => {
    it('flushes only items with matching tag', async () => {
      await store.tags(['posts']).put('post:1', 'p1');
      await store.tags(['posts']).put('post:2', 'p2');
      await store.tags(['users']).put('user:1', 'u1');

      await store.tags(['posts']).flush();

      expect(await store.get('post:1')).toBeNull();
      expect(await store.get('post:2')).toBeNull();
      expect(await store.get('user:1')).toBe('u1');
    });

    it('flushes items tagged with any of the given tags', async () => {
      await store.tags(['posts', 'homepage']).put('featured', 'data');
      await store.tags(['users']).put('user:1', 'u1');

      // Flush by 'homepage' tag — should remove 'featured'
      await store.tags(['homepage']).flush();

      expect(await store.get('featured')).toBeNull();
      expect(await store.get('user:1')).toBe('u1');
    });

    it('does not affect untagged items', async () => {
      await store.put('untagged', 'value');
      await store.tags(['posts']).put('post:1', 'p1');

      await store.tags(['posts']).flush();

      expect(await store.get('untagged')).toBe('value');
    });

    it('flush with multiple tags clears all matching', async () => {
      await store.tags(['posts']).put('post:1', 'p1');
      await store.tags(['comments']).put('comment:1', 'c1');
      await store.tags(['users']).put('user:1', 'u1');

      await store.tags(['posts', 'comments']).flush();

      expect(await store.get('post:1')).toBeNull();
      expect(await store.get('comment:1')).toBeNull();
      expect(await store.get('user:1')).toBe('u1');
    });
  });

  describe('forget', () => {
    it('removes a key and untracks it from tags', async () => {
      const tagged = store.tags(['posts']);
      await tagged.put('post:1', 'p1');
      await tagged.put('post:2', 'p2');

      await tagged.forget('post:1');

      expect(await store.get('post:1')).toBeNull();
      expect(await store.get('post:2')).toBe('p2');

      // After forgetting, getTaggedKeys should not include post:1
      const keys = store.tags(['posts']).getTaggedKeys();
      expect(keys).not.toContain('post:1');
      expect(keys).toContain('post:2');
    });
  });

  describe('has', () => {
    it('checks existence via underlying store', async () => {
      await store.tags(['posts']).put('post:1', 'p1');
      expect(await store.tags(['posts']).has('post:1')).toBe(true);
      expect(await store.tags(['posts']).has('post:999')).toBe(false);
    });
  });

  describe('remember', () => {
    it('caches the callback result with tag tracking', async () => {
      let calls = 0;
      const tagged = store.tags(['posts']);

      const val1 = await tagged.remember('expensive', 60, () => { calls++; return 'computed'; });
      const val2 = await tagged.remember('expensive', 60, () => { calls++; return 'computed2'; });

      expect(val1).toBe('computed');
      expect(val2).toBe('computed'); // cached
      expect(calls).toBe(1);
    });

    it('tracked keys are flushed with tags', async () => {
      await store.tags(['posts']).remember('cached-posts', 60, () => [1, 2, 3]);
      expect(await store.get('cached-posts')).toEqual([1, 2, 3]);

      await store.tags(['posts']).flush();
      expect(await store.get('cached-posts')).toBeNull();
    });
  });

  describe('getTaggedKeys', () => {
    it('returns all keys under the tag', async () => {
      await store.tags(['posts']).put('post:1', 'p1');
      await store.tags(['posts']).put('post:2', 'p2');
      await store.tags(['users']).put('user:1', 'u1');

      const postKeys = store.tags(['posts']).getTaggedKeys();
      expect(postKeys).toContain('post:1');
      expect(postKeys).toContain('post:2');
      expect(postKeys).not.toContain('user:1');
    });

    it('returns union of keys across multiple tags', async () => {
      await store.tags(['posts']).put('post:1', 'p1');
      await store.tags(['users']).put('user:1', 'u1');

      const keys = store.tags(['posts', 'users']).getTaggedKeys();
      expect(keys).toContain('post:1');
      expect(keys).toContain('user:1');
    });
  });

  describe('multi-tag items', () => {
    it('item with multiple tags is flushed by any tag', async () => {
      await store.tags(['posts', 'featured']).put('featured-post', 'fp');

      // Flushing 'featured' should remove the item
      await store.tags(['featured']).flush();
      expect(await store.get('featured-post')).toBeNull();
    });

    it('flushing one tag does not remove keys from other tags index', async () => {
      await store.tags(['posts']).put('post:1', 'p1');
      await store.tags(['posts', 'featured']).put('featured-post', 'fp');

      // Flush 'featured' — removes 'featured-post'
      await store.tags(['featured']).flush();

      // 'post:1' should still be accessible and tracked under 'posts'
      expect(await store.get('post:1')).toBe('p1');
      const postKeys = store.tags(['posts']).getTaggedKeys();
      expect(postKeys).toContain('post:1');
    });
  });
});
