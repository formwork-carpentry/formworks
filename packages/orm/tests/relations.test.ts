/**
 * @module @formwork/orm
 * @description Tests for ORM Relations (CARP-019)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseModel } from '../src/model/BaseModel.js';
import { HasOne, HasMany, BelongsTo, BelongsToMany, eagerLoad, getRelation } from '../src/relations/Relations.js';
import { MockDatabaseAdapter } from '../src/adapters/MockDatabaseAdapter.js';

// ── Model Fixtures ────────────────────────────────────────

class User extends BaseModel {
  static table = 'users';
  static fillable = ['name', 'email'];
}

class Profile extends BaseModel {
  static table = 'profiles';
  static fillable = ['user_id', 'bio'];
}

class Post extends BaseModel {
  static table = 'posts';
  static fillable = ['user_id', 'title'];
}

class Role extends BaseModel {
  static table = 'roles';
  static fillable = ['name'];
}

let db: MockDatabaseAdapter;

beforeEach(() => {
  db = new MockDatabaseAdapter();
  BaseModel.adapter = db;
  BaseModel.clearEvents();
});

// ── HasOne ────────────────────────────────────────────────

describe('CARP-019: HasOne', () => {
  it('resolves a single related model', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new HasOne(Profile, 'user_id', 'id');

    db.queueResult([{ id: 10, user_id: 1, bio: 'Hello world' }]);
    const profile = await relation.resolve(user);

    expect(profile).not.toBeNull();
    expect(profile!.getAttribute('bio')).toBe('Hello world');
    db.assertExecuted('FROM profiles');
    db.assertExecuted('user_id = ?');
  });

  it('returns null when no related model', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new HasOne(Profile, 'user_id', 'id');

    db.queueResult([]);
    const profile = await relation.resolve(user);
    expect(profile).toBeNull();
  });

  it('eager-loads for multiple parents', async () => {
    const users = [
      User.hydrate({ id: 1, name: 'Alice' }),
      User.hydrate({ id: 2, name: 'Bob' }),
      User.hydrate({ id: 3, name: 'Charlie' }),
    ];

    const relation = new HasOne(Profile, 'user_id', 'id');
    db.queueResult([
      { id: 10, user_id: 1, bio: 'Alice bio' },
      { id: 11, user_id: 3, bio: 'Charlie bio' },
    ]);

    await relation.eagerLoad(users, 'profile');

    expect(getRelation<Profile>(users[0], 'profile')).toBeDefined();
    expect(getRelation<Profile | null>(users[1], 'profile')).toBeNull();
    expect(getRelation<Profile>(users[2], 'profile')).toBeDefined();

    // Only ONE query executed (not N+1)
    db.assertQueryCount(1);
    db.assertExecuted('user_id IN');
  });
});

// ── HasMany ───────────────────────────────────────────────

describe('CARP-019: HasMany', () => {
  it('resolves multiple related models', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new HasMany(Post, 'user_id', 'id');

    db.queueResult([
      { id: 1, user_id: 1, title: 'Post 1' },
      { id: 2, user_id: 1, title: 'Post 2' },
    ]);
    const posts = await relation.resolve(user);

    expect(posts).toHaveLength(2);
    expect(posts[0].getAttribute('title')).toBe('Post 1');
    expect(posts[1].getAttribute('title')).toBe('Post 2');
  });

  it('returns empty array when no related', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new HasMany(Post, 'user_id', 'id');

    db.queueResult([]);
    const posts = await relation.resolve(user);
    expect(posts).toEqual([]);
  });

  it('eager-loads grouped by parent', async () => {
    const users = [
      User.hydrate({ id: 1, name: 'Alice' }),
      User.hydrate({ id: 2, name: 'Bob' }),
    ];

    const relation = new HasMany(Post, 'user_id', 'id');
    db.queueResult([
      { id: 1, user_id: 1, title: 'Alice Post 1' },
      { id: 2, user_id: 1, title: 'Alice Post 2' },
      { id: 3, user_id: 2, title: 'Bob Post 1' },
    ]);

    await relation.eagerLoad(users, 'posts');

    const alicePosts = getRelation<Post[]>(users[0], 'posts');
    const bobPosts = getRelation<Post[]>(users[1], 'posts');

    expect(alicePosts).toHaveLength(2);
    expect(bobPosts).toHaveLength(1);
    db.assertQueryCount(1);
  });
});

// ── BelongsTo ─────────────────────────────────────────────

describe('CARP-019: BelongsTo', () => {
  it('resolves the parent model', async () => {
    const post = Post.hydrate({ id: 1, user_id: 5, title: 'My Post' });
    const relation = new BelongsTo(User, 'user_id', 'id');

    db.queueResult([{ id: 5, name: 'Alice' }]);
    const user = await relation.resolve(post);

    expect(user).not.toBeNull();
    expect(user!.getAttribute('name')).toBe('Alice');
  });

  it('returns null when foreign key is null', async () => {
    const post = Post.hydrate({ id: 1, user_id: null, title: 'Orphan' });
    const relation = new BelongsTo(User, 'user_id', 'id');

    const user = await relation.resolve(post);
    expect(user).toBeNull();
    db.assertQueryCount(0); // no query if FK is null
  });

  it('eager-loads deduplicated parent lookups', async () => {
    const posts = [
      Post.hydrate({ id: 1, user_id: 5, title: 'Post A' }),
      Post.hydrate({ id: 2, user_id: 5, title: 'Post B' }),
      Post.hydrate({ id: 3, user_id: 8, title: 'Post C' }),
    ];

    const relation = new BelongsTo(User, 'user_id', 'id');
    db.queueResult([
      { id: 5, name: 'Alice' },
      { id: 8, name: 'Bob' },
    ]);

    await relation.eagerLoad(posts, 'author');

    expect(getRelation<User>(posts[0], 'author')!.getAttribute('name')).toBe('Alice');
    expect(getRelation<User>(posts[1], 'author')!.getAttribute('name')).toBe('Alice');
    expect(getRelation<User>(posts[2], 'author')!.getAttribute('name')).toBe('Bob');

    // Only ONE query for 2 unique user IDs
    db.assertQueryCount(1);
  });
});

// ── BelongsToMany ─────────────────────────────────────────

describe('CARP-019: BelongsToMany', () => {
  it('resolves related models via pivot', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new BelongsToMany(Role, 'role_user', 'user_id', 'role_id');

    db.queueResult([
      { id: 1, name: 'admin' },
      { id: 2, name: 'editor' },
    ]);
    const roles = await relation.resolve(user);

    expect(roles).toHaveLength(2);
    expect(roles[0].getAttribute('name')).toBe('admin');
    db.assertExecuted('JOIN role_user');
  });

  it('eager-loads with pivot grouping', async () => {
    const users = [
      User.hydrate({ id: 1, name: 'Alice' }),
      User.hydrate({ id: 2, name: 'Bob' }),
    ];

    const relation = new BelongsToMany(Role, 'role_user', 'user_id', 'role_id');
    db.queueResult([
      { id: 1, name: 'admin', _pivot_fk: 1 },
      { id: 2, name: 'editor', _pivot_fk: 1 },
      { id: 1, name: 'admin', _pivot_fk: 2 },
    ]);

    await relation.eagerLoad(users, 'roles');

    expect(getRelation<Role[]>(users[0], 'roles')).toHaveLength(2);
    expect(getRelation<Role[]>(users[1], 'roles')).toHaveLength(1);
    db.assertQueryCount(1);
  });

  it('attach() inserts pivot records', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new BelongsToMany(Role, 'role_user', 'user_id', 'role_id');

    db.queueResult([], 2);
    await relation.attach(user, [10, 20]);

    db.assertExecuted('INSERT INTO role_user');
    const q = db.lastQuery()!;
    expect(q.bindings).toContain(1);  // user_id
    expect(q.bindings).toContain(10); // role_id
    expect(q.bindings).toContain(20); // role_id
  });

  it('detach() removes pivot records', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new BelongsToMany(Role, 'role_user', 'user_id', 'role_id');

    db.queueResult([], 1);
    await relation.detach(user, [10]);

    db.assertExecuted('DELETE FROM role_user');
    db.assertExecuted('user_id = ?');
    db.assertExecuted('role_id IN');
  });

  it('detach() without IDs removes all pivot records for parent', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new BelongsToMany(Role, 'role_user', 'user_id', 'role_id');

    db.queueResult([], 3);
    await relation.detach(user);

    const q = db.lastQuery()!;
    expect(q.sql).not.toContain('role_id IN');
    expect(q.sql).toContain('user_id = ?');
  });

  it('sync() replaces all pivot records', async () => {
    const user = User.hydrate({ id: 1, name: 'Alice' });
    const relation = new BelongsToMany(Role, 'role_user', 'user_id', 'role_id');

    db.queueResult([], 0); // detach
    db.queueResult([], 2); // attach

    await relation.sync(user, [5, 10]);

    expect(db.executedQueries.length).toBe(2);
    db.assertExecuted('DELETE FROM role_user');
    db.assertExecuted('INSERT INTO role_user');
  });
});

// ── eagerLoad helper ──────────────────────────────────────

describe('CARP-019: eagerLoad() helper', () => {
  it('loads multiple relations in one pass', async () => {
    const users = [
      User.hydrate({ id: 1, name: 'Alice' }),
      User.hydrate({ id: 2, name: 'Bob' }),
    ];

    // Profile eager load
    db.queueResult([{ id: 10, user_id: 1, bio: 'Alice bio' }]);
    // Posts eager load
    db.queueResult([
      { id: 1, user_id: 1, title: 'Post A' },
      { id: 2, user_id: 2, title: 'Post B' },
    ]);

    await eagerLoad(users, User, {
      profile: () => new HasOne(Profile, 'user_id', 'id'),
      posts: () => new HasMany(Post, 'user_id', 'id'),
    });

    expect(getRelation<Profile>(users[0], 'profile')).toBeDefined();
    expect(getRelation<Profile | null>(users[1], 'profile')).toBeNull();
    expect(getRelation<Post[]>(users[0], 'posts')).toHaveLength(1);
    expect(getRelation<Post[]>(users[1], 'posts')).toHaveLength(1);

    // 2 queries total (1 per relation), not N per parent
    db.assertQueryCount(2);
  });
});
