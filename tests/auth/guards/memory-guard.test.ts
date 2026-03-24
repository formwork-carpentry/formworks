import { describe, it, expect } from 'vitest';
import { HashManager } from '../../../src/auth/hash/HashManager.js';
import { MemoryGuard, InMemoryUserProvider, SimpleUser } from '../../../src/auth/guards/Guards.js';

describe('auth/guards/MemoryGuard', () => {
  it('authenticates with valid credentials and exposes the current user', async () => {
    const hash = new HashManager();
    const provider = new InMemoryUserProvider();
    const alice = new SimpleUser(1, 'alice@example.com', await hash.make('secret'), 'admin');
    provider.addUser(alice);

    const guard = new MemoryGuard(provider, hash);

    expect(await guard.guest()).toBe(true);
    expect(await guard.attempt({ email: 'alice@example.com', password: 'secret' })).toBe(true);
    expect(await guard.check()).toBe(true);
    expect(await guard.id()).toBe(1);

    const current = await guard.user<SimpleUser>();
    expect(current?.email).toBe('alice@example.com');
  });

  it('fails authentication for invalid credentials', async () => {
    const hash = new HashManager();
    const provider = new InMemoryUserProvider();
    provider.addUser(new SimpleUser(1, 'alice@example.com', await hash.make('secret')));

    const guard = new MemoryGuard(provider, hash);

    expect(await guard.attempt({ email: 'alice@example.com', password: 'wrong' })).toBe(false);
    expect(await guard.check()).toBe(false);
    expect(await guard.user()).toBeNull();
  });

  it('logs out authenticated users', async () => {
    const hash = new HashManager();
    const provider = new InMemoryUserProvider();
    const user = new SimpleUser(7, 'u@test.com', await hash.make('pw'));
    provider.addUser(user);

    const guard = new MemoryGuard(provider, hash);
    await guard.login(user);

    expect(await guard.check()).toBe(true);
    await guard.logout();
    expect(await guard.guest()).toBe(true);
    expect(await guard.id()).toBeNull();
  });
});
