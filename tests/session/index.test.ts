import { describe, expect, it } from 'vitest';

import {
  MemorySessionStore,
  Session,
  SessionManager,
  SessionStoreRegistry,
} from '../../src/session/index.js';

describe('session/index', () => {
  it('supports memory store CRUD and explicit ids', async () => {
    const store = new MemorySessionStore('sess-1');

    await store.put('key', 'value');
    expect(await store.get('key')).toBe('value');
    expect(await store.has('key')).toBe(true);
    expect(store.getId()).toBe('sess-1');

    store.setId('sess-2');
    expect(store.getId()).toBe('sess-2');

    await store.forget('key');
    expect(await store.get('key')).toBeNull();
    expect(store.size()).toBe(0);
  });

  it('handles flash lifecycle and old input across request boundaries', async () => {
    const store = new MemorySessionStore('flash');
    const firstRequest = new Session(store);

    await firstRequest.start();
    await firstRequest.flash('success', 'saved');
    await firstRequest.flashInput({ email: 'a@example.com' });
    await firstRequest.save();

    const secondRequest = new Session(store);
    await secondRequest.start();

    expect(await secondRequest.get('success')).toBe('saved');
    expect(await secondRequest.old('email')).toBe('a@example.com');

    await secondRequest.keep('success');
    await secondRequest.save();

    const thirdRequest = new Session(store);
    await thirdRequest.start();
    expect(await thirdRequest.get('success')).toBe('saved');

    await thirdRequest.save();

    const fourthRequest = new Session(store);
    await fourthRequest.start();
    expect(await fourthRequest.get('success')).toBeNull();
  });

  it('creates, verifies, and regenerates csrf token', async () => {
    const session = new Session(new MemorySessionStore('csrf'));

    await session.start();
    const first = await session.token();

    expect(await session.verifyToken(first)).toBe(true);
    expect(await session.verifyToken('invalid')).toBe(false);

    const second = await session.regenerateToken();
    expect(second).not.toBe(first);
    expect(await session.verifyToken(second)).toBe(true);
  });

  it('registers drivers via SessionManager and isolates stores via SessionStoreRegistry', async () => {
    const manager = new SessionManager('custom');
    manager.registerDriver('custom', (config) => new MemorySessionStore(String(config.id ?? 'generated')));

    const session = manager.create(undefined, { id: 'from-config' });
    await session.start();
    await session.put('user', 1);
    expect(await session.get('user')).toBe(1);
    expect(session.getId()).toBe('from-config');

    const registry = new SessionStoreRegistry();
    const a = registry.resolve('A');
    const b = registry.resolve('B');
    await a.put('x', 1);

    expect(await b.get('x')).toBeNull();
    expect(registry.activeSessions().sort()).toEqual(['A', 'B']);
    expect(registry.destroy('A')).toBe(true);

    registry.clear();
    expect(registry.activeSessions()).toEqual([]);
  });

  it('throws when creating unregistered driver', () => {
    const manager = new SessionManager('memory');

    expect(() => manager.create('missing')).toThrow('Session driver "missing" not registered.');
  });
});
