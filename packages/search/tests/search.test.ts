import { describe, it, expect } from 'vitest';
import { SearchManager } from '../src/index.js';

describe('@carpentry/search: SearchManager', () => {
  it('indexes and searches documents using database driver', async () => {
    const indexName = `products-${Date.now()}-${Math.random()}`;
    const search = new SearchManager({ driver: 'database' });

    await search.createIndex(indexName);
    await search.indexMany(indexName, [
      { id: '1', title: 'Blue Widget', price: 30, category: 'tools' },
      { id: '2', title: 'Red Widget', price: 15, category: 'tools' },
      { id: '3', title: 'Desk Lamp', price: 40, category: 'home' },
    ]);

    const result = await search.search(indexName, 'widget', {
      perPage: 10,
      sort: 'price:asc',
      attributesToRetrieve: ['id', 'title', 'price'],
      searchableFields: ['title'],
    });

    expect(result.total).toBe(2);
    expect(result.hits[0]?.document).toEqual({ id: '2', title: 'Red Widget', price: 15 });
    expect(result.hits[1]?.document).toEqual({ id: '1', title: 'Blue Widget', price: 30 });
  });

  it('removes documents and drops indexes', async () => {
    const indexName = `orders-${Date.now()}-${Math.random()}`;
    const search = new SearchManager({ driver: 'database' });

    await search.index(indexName, { id: 'o1', title: 'Order One' });
    await search.index(indexName, { id: 'o2', title: 'Order Two' });

    await search.remove(indexName, 'o1');
    const afterRemove = await search.search(indexName, 'order');
    expect(afterRemove.total).toBe(1);
    expect(afterRemove.hits[0]?.document.id).toBe('o2');

    await search.dropIndex(indexName);
    const afterDrop = await search.search(indexName, 'order');
    expect(afterDrop.total).toBe(0);
  });

  it('returns empty results in null driver mode', async () => {
    const search = new SearchManager({ driver: 'null' });

    await search.createIndex('ignored');
    await search.index('ignored', { id: '1', title: 'Ignored' });

    const result = await search.search('ignored', 'ignored');
    expect(result.total).toBe(0);
    expect(result.hits).toEqual([]);
  });

  it('throws when indexing document without id', async () => {
    const search = new SearchManager({ driver: 'database' });
    await expect(search.index('products', { title: 'No ID' })).rejects.toThrow('must include an "id"');
  });
});
