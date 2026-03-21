/**
 * @module @formwork/auth
 * @description Tests for Auth system (CARP-029, CARP-030)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HashManager } from '../src/hash/HashManager.js';
import { Gate } from '../src/gate/Gate.js';
import { MemoryGuard, InMemoryUserProvider, SimpleUser } from '../src/guards/Guards.js';
import type { IAuthenticatable } from '@formwork/core/auth';

// ── HashManager ───────────────────────────────────────────

describe('CARP-029: HashManager', () => {
  let hash: HashManager;

  beforeEach(() => { hash = new HashManager(); });

  it('make() produces a hash string', async () => {
    const hashed = await hash.make('password123');
    expect(hashed).toContain('$sha256$');
    expect(hashed).not.toBe('password123');
  });

  it('check() verifies correct password', async () => {
    const hashed = await hash.make('secret');
    expect(await hash.check('secret', hashed)).toBe(true);
  });

  it('check() rejects wrong password', async () => {
    const hashed = await hash.make('secret');
    expect(await hash.check('wrong', hashed)).toBe(false);
  });

  it('different calls produce different hashes (salted)', async () => {
    const a = await hash.make('same');
    const b = await hash.make('same');
    expect(a).not.toBe(b); // different salts
  });

  it('check() works across different hashes of same value', async () => {
    const a = await hash.make('password');
    const b = await hash.make('password');
    expect(await hash.check('password', a)).toBe(true);
    expect(await hash.check('password', b)).toBe(true);
  });

  it('check() rejects malformed hash', async () => {
    expect(await hash.check('password', 'not-a-valid-hash')).toBe(false);
  });
});

// ── Guard (MemoryGuard) ───────────────────────────────────

describe('CARP-029: MemoryGuard', () => {
  let guard: MemoryGuard;
  let provider: InMemoryUserProvider;
  let hash: HashManager;
  let alice: SimpleUser;

  beforeEach(async () => {
    hash = new HashManager();
    provider = new InMemoryUserProvider();

    const passwordHash = await hash.make('secret123');
    alice = new SimpleUser(1, 'alice@example.com', passwordHash, 'admin');
    provider.addUser(alice);

    guard = new MemoryGuard(provider, hash);
  });

  it('starts as guest', async () => {
    expect(await guard.guest()).toBe(true);
    expect(await guard.check()).toBe(false);
    expect(await guard.user()).toBeNull();
    expect(await guard.id()).toBeNull();
  });

  it('login() sets the authenticated user', async () => {
    await guard.login(alice);
    expect(await guard.check()).toBe(true);
    expect(await guard.guest()).toBe(false);
    expect(await guard.id()).toBe(1);
  });

  it('user() returns the logged-in user', async () => {
    await guard.login(alice);
    const user = await guard.user<SimpleUser>();
    expect(user!.email).toBe('alice@example.com');
  });

  it('logout() clears the user', async () => {
    await guard.login(alice);
    await guard.logout();
    expect(await guard.guest()).toBe(true);
    expect(await guard.user()).toBeNull();
  });

  it('attempt() with correct credentials logs in', async () => {
    const success = await guard.attempt({ email: 'alice@example.com', password: 'secret123' });
    expect(success).toBe(true);
    expect(await guard.check()).toBe(true);
    expect(await guard.id()).toBe(1);
  });

  it('attempt() with wrong password fails', async () => {
    const success = await guard.attempt({ email: 'alice@example.com', password: 'wrong' });
    expect(success).toBe(false);
    expect(await guard.guest()).toBe(true);
  });

  it('attempt() with unknown email fails', async () => {
    const success = await guard.attempt({ email: 'nobody@example.com', password: 'secret123' });
    expect(success).toBe(false);
  });

  it('attempt() without password field fails', async () => {
    const success = await guard.attempt({ email: 'alice@example.com' });
    expect(success).toBe(false);
  });
});

// ── Gate (Authorization) ──────────────────────────────────

describe('CARP-030: Gate', () => {
  let gate: Gate;
  let admin: SimpleUser;
  let user: SimpleUser;

  beforeEach(() => {
    gate = new Gate();
    admin = new SimpleUser(1, 'admin@ex.com', '', 'admin');
    user = new SimpleUser(2, 'user@ex.com', '', 'user');
  });

  describe('define() + allows()', () => {
    it('allows when callback returns true', async () => {
      gate.define('view-dashboard', () => true);
      expect(await gate.allows(admin, 'view-dashboard')).toBe(true);
    });

    it('denies when callback returns false', async () => {
      gate.define('view-dashboard', () => false);
      expect(await gate.allows(user, 'view-dashboard')).toBe(false);
    });

    it('passes user to callback', async () => {
      gate.define('is-admin', (u: IAuthenticatable) => {
        return (u as SimpleUser).role === 'admin';
      });
      expect(await gate.allows(admin, 'is-admin')).toBe(true);
      expect(await gate.allows(user, 'is-admin')).toBe(false);
    });

    it('passes model argument to callback', async () => {
      const post = { id: 1, userId: 2 };
      gate.define('edit-post', (u: IAuthenticatable, p: unknown) => {
        return (p as { userId: number }).userId === u.getAuthIdentifier();
      });
      expect(await gate.allows(user, 'edit-post', post)).toBe(true);
      expect(await gate.allows(admin, 'edit-post', post)).toBe(false);
    });
  });

  describe('denies()', () => {
    it('inverse of allows()', async () => {
      gate.define('ability', () => false);
      expect(await gate.denies(user, 'ability')).toBe(true);
    });
  });

  describe('before() hook', () => {
    it('returning true grants all abilities (super admin)', async () => {
      gate.before((u) => (u as SimpleUser).role === 'admin' ? true : null);
      gate.define('restricted-action', () => false);

      expect(await gate.allows(admin, 'restricted-action')).toBe(true);
      expect(await gate.allows(user, 'restricted-action')).toBe(false);
    });

    it('returning false denies all abilities', async () => {
      gate.before(() => false);
      gate.define('anything', () => true);

      expect(await gate.allows(admin, 'anything')).toBe(false);
    });

    it('returning null continues to normal checks', async () => {
      gate.before(() => null);
      gate.define('check-me', () => true);

      expect(await gate.allows(user, 'check-me')).toBe(true);
    });
  });

  describe('policy()', () => {
    class Post { constructor(public id: number, public userId: number) {} }

    class PostPolicy {
      update(u: IAuthenticatable, post: Post): boolean {
        return post.userId === u.getAuthIdentifier();
      }
      delete(u: IAuthenticatable, _post: Post): boolean {
        return (u as SimpleUser).role === 'admin';
      }
    }

    beforeEach(() => {
      gate.policy(Post, PostPolicy);
    });

    it('resolves policy method for ability', async () => {
      const post = new Post(1, 2); // owned by user id=2
      expect(await gate.allows(user, 'update', post)).toBe(true);
      expect(await gate.allows(admin, 'update', post)).toBe(false);
    });

    it('resolves different policy methods', async () => {
      const post = new Post(1, 2);
      expect(await gate.allows(admin, 'delete', post)).toBe(true);
      expect(await gate.allows(user, 'delete', post)).toBe(false);
    });

    it('returns false for undefined ability on policy', async () => {
      const post = new Post(1, 2);
      expect(await gate.allows(user, 'nonexistent-ability', post)).toBe(false);
    });
  });

  describe('undefined abilities', () => {
    it('returns false for abilities never defined', async () => {
      expect(await gate.allows(user, 'unknown')).toBe(false);
    });
  });

  describe('has()', () => {
    it('checks if ability is defined', () => {
      gate.define('exists', () => true);
      expect(gate.has('exists')).toBe(true);
      expect(gate.has('nope')).toBe(false);
    });
  });
});
