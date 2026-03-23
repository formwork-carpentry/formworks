/**
 * @module @carpentry/orm
 * @description Tests for BaseModel (CARP-018) — Active Record, Memento, Observer patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseModel } from '../src/model/BaseModel.js';
import type { ModelEvent } from '../src/model/BaseModel.js';
import { MockDatabaseAdapter } from '../src/adapters/MockDatabaseAdapter.js';

// ── Test Model Fixtures ───────────────────────────────────

class User extends BaseModel {
  static table = 'users';
  static fillable = ['name', 'email', 'age'];
  static casts = { age: 'number' as const };
}

class Post extends BaseModel {
  static table = 'posts';
  static fillable = ['title', 'body', 'published'];
  static softDeletes = true;
  static casts = { published: 'boolean' as const };
}

class Guarded extends BaseModel {
  static table = 'guardeds';
  static guarded = ['id', 'role']; // everything except these is fillable
}

class NoTimestamps extends BaseModel {
  static table = 'no_ts';
  static timestamps = false;
  static fillable = ['key', 'value'];
}

// ── Setup ─────────────────────────────────────────────────

let db: MockDatabaseAdapter;

beforeEach(() => {
  db = new MockDatabaseAdapter();
  BaseModel.adapter = db;
  BaseModel.clearEvents();
});

// ── Tests ─────────────────────────────────────────────────

describe('CARP-018: BaseModel — Active Record', () => {

  describe('construction & attributes', () => {
    it('creates a model with attributes', () => {
      const user = new User({ name: 'Alice', email: 'alice@ex.com' });
      expect(user.getAttribute('name')).toBe('Alice');
      expect(user.getAttribute('email')).toBe('alice@ex.com');
    });

    it('getAttributes() returns all attributes', () => {
      const user = new User({ name: 'Bob' });
      expect(user.getAttributes()).toEqual({ name: 'Bob' });
    });

    it('setAttribute() sets a single attribute', () => {
      const user = new User();
      user.setAttribute('name', 'Charlie');
      expect(user.getAttribute('name')).toBe('Charlie');
    });

    it('toJSON() returns plain object', () => {
      const user = new User({ name: 'Alice', email: 'a@ex.com' });
      expect(user.toJSON()).toEqual({ name: 'Alice', email: 'a@ex.com' });
    });

    it('new model does not exist in DB', () => {
      const user = new User({ name: 'New' });
      expect(user.exists()).toBe(false);
    });
  });

  describe('mass assignment protection', () => {
    it('fill() respects fillable whitelist', () => {
      const user = new User();
      user.fill({ name: 'Alice', email: 'a@ex.com', id: 999, admin: true });
      expect(user.getAttribute('name')).toBe('Alice');
      expect(user.getAttribute('email')).toBe('a@ex.com');
      expect(user.getAttribute('id')).toBeUndefined(); // not fillable
      expect(user.getAttribute('admin')).toBeUndefined(); // not fillable
    });

    it('guarded model blocks guarded fields', () => {
      const g = new Guarded();
      g.fill({ id: 999, role: 'admin', name: 'test', data: 'ok' });
      expect(g.getAttribute('id')).toBeUndefined();   // guarded
      expect(g.getAttribute('role')).toBeUndefined();  // guarded
      expect(g.getAttribute('name')).toBe('test');     // not guarded
      expect(g.getAttribute('data')).toBe('ok');       // not guarded
    });
  });

  describe('dirty tracking (Memento pattern)', () => {
    it('isDirty() is false on fresh model', () => {
      const user = new User({ name: 'Alice' });
      expect(user.isDirty()).toBe(false);
    });

    it('isDirty() detects attribute changes', () => {
      const user = new User({ name: 'Alice' });
      user.setAttribute('name', 'Bob');
      expect(user.isDirty()).toBe(true);
      expect(user.isDirty('name')).toBe(true);
    });

    it('isDirty(attr) returns false for unchanged attributes', () => {
      const user = new User({ name: 'Alice', email: 'a@ex.com' });
      user.setAttribute('name', 'Bob');
      expect(user.isDirty('email')).toBe(false);
    });

    it('getOriginal() returns value before modification', () => {
      const user = new User({ name: 'Alice' });
      user.setAttribute('name', 'Bob');
      expect(user.getOriginal('name')).toBe('Alice');
      expect(user.getAttribute('name')).toBe('Bob');
    });

    it('getDirty() returns only changed attributes', () => {
      const user = new User({ name: 'Alice', email: 'a@ex.com' });
      user.setAttribute('name', 'Bob');
      expect(user.getDirty()).toEqual({ name: 'Bob' });
    });

    it('save() resets dirty state', async () => {
      db.queueResult([], 1, 1); // insert result
      const user = new User({ name: 'Alice' });
      user.setAttribute('name', 'Bob');
      expect(user.isDirty()).toBe(true);
      await user.save();
      expect(user.isDirty()).toBe(false);
    });
  });

  describe('save() — insert', () => {
    it('inserts a new model', async () => {
      db.queueResult([], 1, 42);
      const user = new User({ name: 'Alice', email: 'a@ex.com' });

      await user.save();

      expect(user.exists()).toBe(true);
      expect(user.getKey()).toBe(42); // from insertId
      db.assertExecuted('INSERT INTO users');
    });

    it('sets timestamps on insert', async () => {
      db.queueResult([], 1, 1);
      const user = new User({ name: 'Alice' });
      await user.save();

      expect(user.getAttribute('created_at')).toBeDefined();
      expect(user.getAttribute('updated_at')).toBeDefined();
    });

    it('skips timestamps when disabled', async () => {
      db.queueResult([], 1, 1);
      const item = new NoTimestamps({ key: 'a', value: 'b' });
      await item.save();

      expect(item.getAttribute('created_at')).toBeUndefined();
    });
  });

  describe('save() — update', () => {
    it('updates a persisted model', async () => {
      // Simulate an existing model
      const user = User.hydrate({ id: 1, name: 'Alice', email: 'a@ex.com' });
      user.setAttribute('name', 'Bob');

      db.queueResult([], 1);
      await user.save();

      db.assertExecuted('UPDATE users SET');
      const q = db.lastQuery()!;
      expect(q.sql).toContain('name = ?');
      expect(q.sql).toContain('WHERE id = ?');
    });

    it('updates only dirty attributes', async () => {
      const user = User.hydrate({ id: 1, name: 'Alice', email: 'a@ex.com' });
      user.setAttribute('name', 'Bob');

      db.queueResult([], 1);
      await user.save();

      const q = db.lastQuery()!;
      // Should include name and updated_at, but NOT email
      expect(q.bindings).toContain('Bob');
      expect(q.bindings).not.toContain('a@ex.com');
    });

    it('skips update when nothing is dirty', async () => {
      const user = User.hydrate({ id: 1, name: 'Alice' });
      await user.save();
      db.assertQueryCount(0); // no query executed
    });

    it('updates via update() method', async () => {
      const user = User.hydrate({ id: 1, name: 'Alice' });
      db.queueResult([], 1);
      await user.update({ name: 'Bob' });

      db.assertExecuted('UPDATE users');
      expect(user.getAttribute('name')).toBe('Bob');
    });
  });

  describe('delete()', () => {
    it('hard deletes a model', async () => {
      const user = User.hydrate({ id: 1, name: 'Alice' });
      db.queueResult([], 1);
      await user.delete();

      db.assertExecuted('DELETE FROM users');
      expect(user.exists()).toBe(false);
    });
  });

  describe('soft deletes', () => {
    it('soft-deletes by setting deleted_at', async () => {
      const post = Post.hydrate({ id: 1, title: 'Hello' });
      db.queueResult([], 1);
      await post.delete();

      db.assertExecuted('UPDATE posts SET');
      db.assertExecuted('deleted_at');
      expect(post.trashed()).toBe(true);
    });

    it('trashed() returns false for non-deleted models', () => {
      const post = Post.hydrate({ id: 1, title: 'Hello' });
      expect(post.trashed()).toBe(false);
    });

    it('restore() clears deleted_at', async () => {
      const post = Post.hydrate({ id: 1, title: 'Hello', deleted_at: '2024-01-01' });
      db.queueResult([], 1);
      await post.restore();

      db.assertExecuted('UPDATE posts SET');
      expect(post.trashed()).toBe(false);
      expect(post.getAttribute('deleted_at')).toBeNull();
    });

    it('query() auto-filters soft-deleted by default', () => {
      const ast = Post.query().getAST();
      expect(ast.wheres).toContainEqual(
        expect.objectContaining({ column: 'deleted_at', operator: 'IS NULL' }),
      );
    });

    it('withTrashed() removes soft-delete filter', () => {
      const ast = Post.withTrashed().getAST();
      expect(ast.wheres).toHaveLength(0);
    });
  });

  describe('static query methods', () => {
    it('find() returns model by primary key', async () => {
      db.queueResult([{ id: 1, name: 'Alice', email: 'a@ex.com' }]);
      const user = await User.find(1);

      expect(user).not.toBeNull();
      expect(user!.getAttribute('name')).toBe('Alice');
      expect(user!.exists()).toBe(true);
    });

    it('find() returns null when not found', async () => {
      db.queueResult([]);
      const user = await User.find(999);
      expect(user).toBeNull();
    });

    it('findOrFail() throws on not found', async () => {
      db.queueResult([]);
      await expect(User.findOrFail(999)).rejects.toThrow('not found');
    });

    it('all() returns all models', async () => {
      db.queueResult([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
      const users = await User.all();
      expect(users).toHaveLength(2);
      expect(users[0].getAttribute('name')).toBe('Alice');
      expect(users[1].exists()).toBe(true);
    });

    it('where() returns query builder that hydrates', async () => {
      db.queueResult([{ id: 1, name: 'Alice' }]);
      const users = await User.where('name', 'Alice').get();
      expect(users).toHaveLength(1);
      expect(users[0]).toBeInstanceOf(User);
    });

    it('create() inserts and returns model', async () => {
      db.queueResult([], 1, 5);
      const user = await User.create({ name: 'New', email: 'n@ex.com' });
      expect(user.exists()).toBe(true);
      expect(user.getKey()).toBe(5);
    });
  });

  describe('hydrate()', () => {
    it('creates a model marked as existing', () => {
      const user = User.hydrate({ id: 1, name: 'Alice' });
      expect(user.exists()).toBe(true);
      expect(user.isDirty()).toBe(false);
      expect(user.getAttribute('name')).toBe('Alice');
    });
  });

  describe('casting', () => {
    it('casts to number', () => {
      const user = User.hydrate({ id: 1, name: 'Alice', age: '25' });
      expect(user.getAttribute<number>('age')).toBe(25);
      expect(typeof user.getAttribute('age')).toBe('number');
    });

    it('casts to boolean', () => {
      const post = Post.hydrate({ id: 1, published: 1 });
      expect(post.getAttribute<boolean>('published')).toBe(true);
    });
  });

  describe('replicate() — Prototype pattern', () => {
    it('creates a copy without primary key or timestamps', () => {
      const user = User.hydrate({
        id: 1, name: 'Alice', email: 'a@ex.com',
        created_at: '2024-01-01', updated_at: '2024-01-02',
      });
      const clone = user.replicate();

      expect(clone.getAttribute('name')).toBe('Alice');
      expect(clone.getAttribute('email')).toBe('a@ex.com');
      expect(clone.getAttribute('id')).toBeUndefined();
      expect(clone.getAttribute('created_at')).toBeUndefined();
      expect(clone.exists()).toBe(false);
    });
  });

  describe('model events (Observer pattern)', () => {
    afterEach(() => {
      BaseModel.clearEvents();
    });

    it('fires creating/created events on insert', async () => {
      const events: string[] = [];
      User.on('creating', () => { events.push('creating'); });
      User.on('created', () => { events.push('created'); });
      User.on('saving', () => { events.push('saving'); });
      User.on('saved', () => { events.push('saved'); });

      db.queueResult([], 1, 1);
      const user = new User({ name: 'Alice' });
      await user.save();

      expect(events).toEqual(['saving', 'creating', 'created', 'saved']);
    });

    it('fires updating/updated events on update', async () => {
      const events: string[] = [];
      User.on('updating', () => { events.push('updating'); });
      User.on('updated', () => { events.push('updated'); });
      User.on('saving', () => { events.push('saving'); });
      User.on('saved', () => { events.push('saved'); });

      const user = User.hydrate({ id: 1, name: 'Alice' });
      user.setAttribute('name', 'Bob');
      db.queueResult([], 1);
      await user.save();

      expect(events).toEqual(['saving', 'updating', 'updated', 'saved']);
    });

    it('fires deleting/deleted events', async () => {
      const events: string[] = [];
      User.on('deleting', () => { events.push('deleting'); });
      User.on('deleted', () => { events.push('deleted'); });

      const user = User.hydrate({ id: 1, name: 'Alice' });
      db.queueResult([], 1);
      await user.delete();

      expect(events).toEqual(['deleting', 'deleted']);
    });

    it('returning false from creating cancels insert', async () => {
      User.on('creating', () => false);

      const user = new User({ name: 'Alice' });
      await user.save();

      db.assertQueryCount(0); // no INSERT executed
      expect(user.exists()).toBe(false);
    });

    it('returning false from deleting cancels delete', async () => {
      User.on('deleting', () => false);

      const user = User.hydrate({ id: 1, name: 'Alice' });
      await user.delete();

      db.assertQueryCount(0);
      expect(user.exists()).toBe(true); // still exists
    });
  });

  describe('ModelQueryBuilder', () => {
    it('chains where and returns hydrated models', async () => {
      db.queueResult([{ id: 1, name: 'Admin' }]);
      const users = await User.where('role', 'admin').orderBy('name').limit(5).get();

      expect(users).toHaveLength(1);
      expect(users[0]).toBeInstanceOf(User);
      expect(users[0].exists()).toBe(true);
    });

    it('first() returns single hydrated model', async () => {
      db.queueResult([{ id: 1, name: 'Alice' }]);
      const user = await User.where('email', 'a@ex.com').first();

      expect(user).toBeInstanceOf(User);
      expect(user!.getAttribute('name')).toBe('Alice');
    });

    it('first() returns null when no match', async () => {
      db.queueResult([]);
      const user = await User.where('email', 'nope@ex.com').first();
      expect(user).toBeNull();
    });

    it('count() returns number', async () => {
      db.queueResult([{ aggregate: 5 }]);
      const count = await User.where('active', true).count();
      expect(count).toBe(5);
    });
  });
});

// ── Userstamps ────────────────────────────────────────────

class AuditedPost extends BaseModel {
  static table = 'posts';
  static fillable = ['title'];
  static userstamps = true;
}

class CustomAuditModel extends BaseModel {
  static table = 'docs';
  static fillable = ['content'];
  static userstamps = true;
  static createdByColumn = 'author_id';
  static updatedByColumn = 'last_editor_id';
}

describe('Userstamps — tracks WHO created/updated a record', () => {
  beforeEach(() => {
    BaseModel.clearEvents();
  });

  afterEach(() => {
    BaseModel.userResolver = null;
  });

  describe('insert with userstamps', () => {
    it('sets created_by and updated_by on insert', async () => {
      BaseModel.userResolver = () => 42;
      db.queueResult([], 1, 1);

      const post = new AuditedPost({ title: 'Hello' });
      await post.save();

      expect(post.getAttribute('created_by')).toBe(42);
      expect(post.getAttribute('updated_by')).toBe(42);
      db.assertExecuted('INSERT INTO posts');
    });

    it('sets null when no user resolver is configured', async () => {
      BaseModel.userResolver = null;
      db.queueResult([], 1, 1);

      const post = new AuditedPost({ title: 'Hello' });
      await post.save();

      expect(post.getAttribute('created_by')).toBeNull();
      expect(post.getAttribute('updated_by')).toBeNull();
    });

    it('sets null when resolver returns null (unauthenticated)', async () => {
      BaseModel.userResolver = () => null;
      db.queueResult([], 1, 1);

      const post = new AuditedPost({ title: 'Hello' });
      await post.save();

      expect(post.getAttribute('created_by')).toBeNull();
    });
  });

  describe('update with userstamps', () => {
    it('updates updated_by but not created_by on update', async () => {
      BaseModel.userResolver = () => 99;

      const post = AuditedPost.hydrate({ id: 1, title: 'Old', created_by: 42, updated_by: 42 });
      post.setAttribute('title', 'New');
      db.queueResult([], 1);
      await post.save();

      // created_by unchanged (set only on insert), updated_by changed to current user
      expect(post.getAttribute('created_by')).toBe(42);
      expect(post.getAttribute('updated_by')).toBe(99);

      const q = db.lastQuery()!;
      expect(q.bindings).toContain(99); // updated_by in SET clause
    });

    it('resolver can return string IDs (UUID users)', async () => {
      BaseModel.userResolver = () => 'usr_abc123';
      db.queueResult([], 1, 1);

      const post = new AuditedPost({ title: 'Hello' });
      await post.save();

      expect(post.getAttribute('created_by')).toBe('usr_abc123');
      expect(post.getAttribute('updated_by')).toBe('usr_abc123');
    });
  });

  describe('custom column names', () => {
    it('uses custom createdByColumn and updatedByColumn', async () => {
      BaseModel.userResolver = () => 7;
      db.queueResult([], 1, 1);

      const doc = new CustomAuditModel({ content: 'Hello' });
      await doc.save();

      expect(doc.getAttribute('author_id')).toBe(7);
      expect(doc.getAttribute('last_editor_id')).toBe(7);
      // Default columns should NOT be set
      expect(doc.getAttribute('created_by')).toBeUndefined();
      expect(doc.getAttribute('updated_by')).toBeUndefined();
    });
  });

  describe('userstamps disabled by default', () => {
    it('User model (userstamps=false) does not set created_by', async () => {
      BaseModel.userResolver = () => 42;
      db.queueResult([], 1, 1);

      const user = new User({ name: 'Alice', email: 'a@ex.com' });
      await user.save();

      expect(user.getAttribute('created_by')).toBeUndefined();
      expect(user.getAttribute('updated_by')).toBeUndefined();
    });
  });

  describe('replicate() strips userstamp columns', () => {
    it('clone has no userstamp values', () => {
      const post = AuditedPost.hydrate({
        id: 1, title: 'Hello',
        created_at: '2024-01-01', updated_at: '2024-01-02',
        created_by: 42, updated_by: 42,
      });
      const clone = post.replicate();

      expect(clone.getAttribute('title')).toBe('Hello');
      expect(clone.getAttribute('id')).toBeUndefined();
      expect(clone.getAttribute('created_by')).toBeUndefined();
      expect(clone.getAttribute('updated_by')).toBeUndefined();
    });
  });

  describe('Blueprint.userstamps()', () => {
    // Imported here to keep test self-contained
    it('adds created_by and updated_by columns', async () => {
      const { Blueprint } = await import('../src/migrations/Migration.js');
      const bp = new Blueprint('posts');
      bp.userstamps();

      expect(bp.columns).toHaveLength(2);
      expect(bp.columns[0].name).toBe('created_by');
      expect(bp.columns[0].type).toBe('bigInteger');
      expect(bp.columns[0].nullable).toBe(true);
      expect(bp.columns[1].name).toBe('updated_by');
    });

    it('accepts custom column names', async () => {
      const { Blueprint } = await import('../src/migrations/Migration.js');
      const bp = new Blueprint('docs');
      bp.userstamps('author_id', 'last_editor_id');

      expect(bp.columns[0].name).toBe('author_id');
      expect(bp.columns[1].name).toBe('last_editor_id');
    });
  });
});
