/**
 * @module @formwork/orm
 * @description Tests for QueryBuilder (CARP-017) — verifies AST structure and compiled SQL
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryBuilder } from '../src/query/QueryBuilder.js';
import { MockDatabaseAdapter } from '../src/adapters/MockDatabaseAdapter.js';

describe('CARP-017: QueryBuilder', () => {
  let db: MockDatabaseAdapter;

  beforeEach(() => {
    db = new MockDatabaseAdapter();
  });

  function qb<T = Record<string, unknown>>(table: string = 'users'): QueryBuilder<T> {
    return new QueryBuilder<T>(db, table);
  }

  describe('SELECT — column selection', () => {
    it('selects all columns by default', () => {
      const sql = qb().toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users');
      expect(sql.bindings).toEqual([]);
    });

    it('selects specific columns', () => {
      const sql = qb().select('id', 'name', 'email').toCompiledQuery();
      expect(sql.sql).toBe('SELECT id, name, email FROM users');
    });

    it('supports DISTINCT', () => {
      const sql = qb().select('email').distinct().toCompiledQuery();
      expect(sql.sql).toBe('SELECT DISTINCT email FROM users');
    });
  });

  describe('WHERE clauses', () => {
    it('where(col, val) — implicit equals', () => {
      const sql = qb().where('status', 'active').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE status = ?');
      expect(sql.bindings).toEqual(['active']);
    });

    it('where(col, op, val) — explicit operator', () => {
      const sql = qb().where('age', '>', 18).toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE age > ?');
      expect(sql.bindings).toEqual([18]);
    });

    it('multiple where() chains with AND', () => {
      const sql = qb().where('status', 'active').where('role', 'admin').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE status = ? AND role = ?');
      expect(sql.bindings).toEqual(['active', 'admin']);
    });

    it('orWhere()', () => {
      const sql = qb().where('role', 'admin').orWhere('role', 'superadmin').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE role = ? OR role = ?');
      expect(sql.bindings).toEqual(['admin', 'superadmin']);
    });

    it('whereIn()', () => {
      const sql = qb().whereIn('id', [1, 2, 3]).toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE id IN (?, ?, ?)');
      expect(sql.bindings).toEqual([1, 2, 3]);
    });

    it('whereNull()', () => {
      const sql = qb().whereNull('deleted_at').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE deleted_at IS NULL');
      expect(sql.bindings).toEqual([]);
    });

    it('whereNotNull()', () => {
      const sql = qb().whereNotNull('email_verified_at').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE email_verified_at IS NOT NULL');
    });

    it('whereBetween()', () => {
      const sql = qb().whereBetween('age', [18, 65]).toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users WHERE age BETWEEN ? AND ?');
      expect(sql.bindings).toEqual([18, 65]);
    });
  });

  describe('JOIN clauses', () => {
    it('inner join', () => {
      const sql = qb('posts').join('users', 'posts.user_id', '=', 'users.id').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM posts JOIN users ON posts.user_id = users.id');
    });

    it('left join', () => {
      const sql = qb('posts').leftJoin('comments', 'posts.id', '=', 'comments.post_id').toCompiledQuery();
      expect(sql.sql).toContain('LEFT JOIN comments');
    });
  });

  describe('ORDER BY', () => {
    it('single order', () => {
      const sql = qb().orderBy('created_at', 'desc').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users ORDER BY created_at DESC');
    });

    it('multiple orders', () => {
      const sql = qb().orderBy('name').orderBy('id', 'desc').toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users ORDER BY name ASC, id DESC');
    });
  });

  describe('GROUP BY + HAVING', () => {
    it('group by single column', () => {
      const sql = qb().select('role', 'COUNT(*) as count').groupBy('role').toCompiledQuery();
      expect(sql.sql).toBe('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    });

    it('having clause', () => {
      const sql = qb()
        .select('role', 'COUNT(*) as count')
        .groupBy('role')
        .having('count', '>', 5)
        .toCompiledQuery();
      expect(sql.sql).toContain('HAVING count > ?');
      expect(sql.bindings).toEqual([5]);
    });
  });

  describe('LIMIT + OFFSET', () => {
    it('limit()', () => {
      const sql = qb().limit(10).toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users LIMIT 10');
    });

    it('limit + offset', () => {
      const sql = qb().limit(10).offset(20).toCompiledQuery();
      expect(sql.sql).toBe('SELECT * FROM users LIMIT 10 OFFSET 20');
    });
  });

  describe('complex query chaining', () => {
    it('builds a realistic query', () => {
      const sql = qb('posts')
        .select('posts.id', 'posts.title', 'users.name as author')
        .join('users', 'posts.user_id', '=', 'users.id')
        .where('posts.published', true)
        .where('posts.created_at', '>', '2024-01-01')
        .whereNull('posts.deleted_at')
        .orderBy('posts.created_at', 'desc')
        .limit(20)
        .offset(40)
        .toCompiledQuery();

      expect(sql.sql).toBe(
        'SELECT posts.id, posts.title, users.name as author FROM posts' +
        ' JOIN users ON posts.user_id = users.id' +
        ' WHERE posts.published = ? AND posts.created_at > ? AND posts.deleted_at IS NULL' +
        ' ORDER BY posts.created_at DESC' +
        ' LIMIT 20 OFFSET 40'
      );
      expect(sql.bindings).toEqual([true, '2024-01-01']);
    });
  });

  describe('terminal operations — get(), first()', () => {
    it('get() executes and returns rows', async () => {
      db.queueResult([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
      const rows = await qb().get();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: 1, name: 'Alice' });
      db.assertExecuted('SELECT * FROM users');
    });

    it('first() returns single row or null', async () => {
      db.queueResult([{ id: 1, name: 'Alice' }]);
      const row = await qb().where('id', 1).first();
      expect(row).toEqual({ id: 1, name: 'Alice' });
      db.assertExecuted('LIMIT 1');
    });

    it('first() returns null when no results', async () => {
      db.queueResult([]);
      const row = await qb().where('id', 999).first();
      expect(row).toBeNull();
    });

    it('firstOrFail() throws on no results', async () => {
      db.queueResult([]);
      await expect(qb().firstOrFail()).rejects.toThrow('No results found');
    });
  });

  describe('aggregates', () => {
    it('count()', async () => {
      db.queueResult([{ aggregate: 42 }]);
      const count = await qb().count();
      expect(count).toBe(42);
      db.assertExecuted('COUNT(*)');
    });

    it('sum()', async () => {
      db.queueResult([{ aggregate: 1500 }]);
      const total = await qb('orders').sum('amount');
      expect(total).toBe(1500);
      db.assertExecuted('SUM(amount)');
    });

    it('avg()', async () => {
      db.queueResult([{ aggregate: 25.5 }]);
      expect(await qb().avg('age')).toBe(25.5);
    });

    it('min() / max()', async () => {
      db.queueResult([{ aggregate: 1 }]);
      expect(await qb().min('id')).toBe(1);
      db.assertExecuted('MIN(id)');
    });
  });

  describe('paginate()', () => {
    it('returns paginated result', async () => {
      // First query: count
      db.queueResult([{ aggregate: 100 }]);
      // Second query: data
      db.queueResult([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const page = await qb().paginate(2, 3);

      expect(page.total).toBe(100);
      expect(page.perPage).toBe(3);
      expect(page.currentPage).toBe(2);
      expect(page.lastPage).toBe(34); // ceil(100/3)
      expect(page.hasMorePages).toBe(true);
      expect(page.data).toHaveLength(3);

      // Verify offset
      const dataQuery = db.executedQueries[1];
      expect(dataQuery.sql).toContain('LIMIT 3');
      expect(dataQuery.sql).toContain('OFFSET 3'); // (2-1)*3
    });
  });

  describe('chunk()', () => {
    it('processes rows in batches', async () => {
      db.queueResult([{ id: 1 }, { id: 2 }]); // batch 1
      db.queueResult([{ id: 3 }]);              // batch 2 (< size, stops)

      const batches: unknown[][] = [];
      await qb().chunk(2, (rows) => { batches.push(rows); });

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(1);
    });

    it('stops when batch is empty', async () => {
      db.queueResult([]); // empty immediately

      const batches: unknown[][] = [];
      await qb().chunk(10, (rows) => { batches.push(rows); });

      expect(batches).toHaveLength(0);
    });
  });

  describe('INSERT', () => {
    it('inserts a single row', async () => {
      db.queueResult([], 1, 1);
      await qb().insert({ name: 'Alice', email: 'alice@example.com' });

      const q = db.lastQuery()!;
      expect(q.sql).toBe('INSERT INTO users (name, email) VALUES (?, ?)');
      expect(q.bindings).toEqual(['Alice', 'alice@example.com']);
      expect(q.type).toBe('insert');
    });

    it('inserts multiple rows', async () => {
      db.queueResult([], 2);
      await qb().insert([
        { name: 'Alice', email: 'a@ex.com' },
        { name: 'Bob', email: 'b@ex.com' },
      ]);

      const q = db.lastQuery()!;
      expect(q.sql).toBe('INSERT INTO users (name, email) VALUES (?, ?), (?, ?)');
      expect(q.bindings).toEqual(['Alice', 'a@ex.com', 'Bob', 'b@ex.com']);
    });
  });

  describe('UPDATE', () => {
    it('updates with where clause', async () => {
      db.queueResult([], 1);
      const affected = await qb().where('id', 1).update({ name: 'Updated' });

      expect(affected).toBe(1);
      const q = db.lastQuery()!;
      expect(q.sql).toBe('UPDATE users SET name = ? WHERE id = ?');
      expect(q.bindings).toEqual(['Updated', 1]);
      expect(q.type).toBe('update');
    });
  });

  describe('DELETE', () => {
    it('deletes with where clause', async () => {
      db.queueResult([], 1);
      const affected = await qb().where('id', 1).delete();

      expect(affected).toBe(1);
      const q = db.lastQuery()!;
      expect(q.sql).toBe('DELETE FROM users WHERE id = ?');
      expect(q.bindings).toEqual([1]);
      expect(q.type).toBe('delete');
    });
  });

  describe('MockDatabaseAdapter', () => {
    it('records all executed queries', async () => {
      await qb().get();
      await qb('posts').where('id', 1).get();

      db.assertQueryCount(2);
      db.assertExecuted('FROM users');
      db.assertExecuted('FROM posts');
    });

    it('assertExecuted throws on miss', () => {
      expect(() => db.assertExecuted('nonexistent')).toThrow('Expected query');
    });

    it('reset clears state', async () => {
      await qb().get();
      db.assertQueryCount(1);
      db.reset();
      db.assertQueryCount(0);
    });
  });
});
