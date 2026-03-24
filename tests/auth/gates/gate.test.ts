import { describe, it, expect } from 'vitest';
import { Gate } from '../../../src/auth/gate/Gate.js';
import { SimpleUser } from '../../../src/auth/guards/Guards.js';

describe('auth/gates/Gate', () => {
  it('allows and denies abilities defined with callbacks', async () => {
    const gate = new Gate();
    const admin = new SimpleUser(1, 'admin@test.com', 'hash', 'admin');
    const member = new SimpleUser(2, 'member@test.com', 'hash', 'user');

    gate.define('manage-users', (user) => (user as SimpleUser).role === 'admin');

    expect(await gate.allows(admin, 'manage-users')).toBe(true);
    expect(await gate.denies(member, 'manage-users')).toBe(true);
  });

  it('supports before hooks for global authorization rules', async () => {
    const gate = new Gate();
    const root = new SimpleUser(99, 'root@test.com', 'hash', 'root');

    gate.before((user) => {
      if ((user as SimpleUser).role === 'root') return true;
      return null;
    });

    expect(await gate.allows(root, 'anything')).toBe(true);
  });

  it('authorizes through policy methods for model instances', async () => {
    class Post {
      constructor(public authorId: number) {}
    }

    class PostPolicy {
      update(user: SimpleUser, post: Post): boolean {
        return user.id === post.authorId;
      }
    }

    const gate = new Gate();
    const alice = new SimpleUser(10, 'alice@test.com', 'hash', 'user');
    const bob = new SimpleUser(20, 'bob@test.com', 'hash', 'user');
    const post = new Post(10);

    gate.policy(Post, PostPolicy);

    expect(await gate.allows(alice, 'update', post)).toBe(true);
    expect(await gate.allows(bob, 'update', post)).toBe(false);
  });
});
