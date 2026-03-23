import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySessionStore, Session, SessionManager, SessionStoreRegistry } from '../src/index.js';

describe('CARP-015: MemorySessionStore', () => {
  let store: MemorySessionStore;
  beforeEach(() => { store = new MemorySessionStore('test-session'); });

  it('get/put', async () => {
    await store.put('name', 'Alice');
    expect(await store.get('name')).toBe('Alice');
  });

  it('returns null for missing key', async () => {
    expect(await store.get('nope')).toBeNull();
  });

  it('has()', async () => {
    await store.put('key', 'val');
    expect(await store.has('key')).toBe(true);
    expect(await store.has('nope')).toBe(false);
  });

  it('forget()', async () => {
    await store.put('key', 'val');
    await store.forget('key');
    expect(await store.has('key')).toBe(false);
  });

  it('flush()', async () => {
    await store.put('a', 1);
    await store.put('b', 2);
    await store.flush();
    expect(store.size()).toBe(0);
  });

  it('all()', async () => {
    await store.put('a', 1);
    await store.put('b', 2);
    expect(await store.all()).toEqual({ a: 1, b: 2 });
  });

  it('getId/setId', () => {
    expect(store.getId()).toBe('test-session');
    store.setId('new-id');
    expect(store.getId()).toBe('new-id');
  });

  it('auto-generates ID if not provided', () => {
    const autoStore = new MemorySessionStore();
    expect(autoStore.getId()).toBeTruthy();
    expect(autoStore.getId().length).toBe(40); // 20 random bytes = 40 hex chars
  });
});

describe('CARP-015: Session', () => {
  let session: Session;

  beforeEach(async () => {
    session = new Session(new MemorySessionStore('sess-1'));
    await session.start();
  });

  describe('basic CRUD', () => {
    it('put + get', async () => {
      await session.put('user', { id: 1, name: 'Alice' });
      expect(await session.get('user')).toEqual({ id: 1, name: 'Alice' });
    });

    it('get with default value', async () => {
      expect(await session.get('missing', 'default')).toBe('default');
    });

    it('has/forget', async () => {
      await session.put('key', 'val');
      expect(await session.has('key')).toBe(true);
      await session.forget('key');
      expect(await session.has('key')).toBe(false);
    });

    it('flush clears everything', async () => {
      await session.put('a', 1);
      await session.put('b', 2);
      await session.flush();
      expect(await session.has('a')).toBe(false);
      expect(await session.has('b')).toBe(false);
    });
  });

  describe('flash data', () => {
    it('flash data available immediately', async () => {
      await session.flash('success', 'Item created!');
      expect(await session.get('success')).toBe('Item created!');
    });

    it('flash data removed after save() + next start()', async () => {
      await session.flash('message', 'Hello');
      await session.save();

      // Simulate next request: new Session instance with same store
      const nextSession = new Session(session.getStore());
      await nextSession.start();

      // Flash data still available on this request
      expect(await nextSession.get('message')).toBe('Hello');

      // After save, flash data should be cleaned
      await nextSession.save();

      const thirdSession = new Session(session.getStore());
      await thirdSession.start();
      expect(await thirdSession.get('message')).toBeNull();
    });

    it('reflash() keeps flash data for one more request', async () => {
      await session.flash('notice', 'Keep me');
      await session.save();

      const next = new Session(session.getStore());
      await next.start();
      await next.reflash(); // keep it
      await next.save();

      const third = new Session(session.getStore());
      await third.start();
      expect(await third.get('notice')).toBe('Keep me'); // still here

      await third.save();
      const fourth = new Session(session.getStore());
      await fourth.start();
      expect(await fourth.get('notice')).toBeNull(); // now gone
    });

    it('keep() preserves specific flash keys', async () => {
      await session.flash('msg1', 'A');
      await session.flash('msg2', 'B');
      await session.save();

      const next = new Session(session.getStore());
      await next.start();
      await next.keep('msg1'); // keep only msg1
      await next.save();

      const third = new Session(session.getStore());
      await third.start();
      expect(await third.get('msg1')).toBe('A'); // kept
      expect(await third.get('msg2')).toBeNull(); // expired
    });
  });

  describe('old input', () => {
    it('flashInput() + old()', async () => {
      await session.flashInput({ name: 'Alice', email: 'a@b.com' });
      await session.save();

      const next = new Session(session.getStore());
      await next.start();
      expect(await next.old('name')).toBe('Alice');
      expect(await next.old('email')).toBe('a@b.com');
      expect(await next.old('missing', 'default')).toBe('default');
    });

    it('hasOldInput()', async () => {
      await session.flashInput({ name: 'Alice' });
      await session.save();

      const next = new Session(session.getStore());
      await next.start();
      expect(await next.hasOldInput('name')).toBe(true);
      expect(await next.hasOldInput('nope')).toBe(false);
    });

    it('old input cleared after one request', async () => {
      await session.flashInput({ name: 'Alice' });
      await session.save();

      const next = new Session(session.getStore());
      await next.start();
      await next.save(); // consumed

      const third = new Session(session.getStore());
      await third.start();
      expect(await third.hasOldInput('name')).toBe(false);
    });
  });

  describe('CSRF token', () => {
    it('token() generates and persists', async () => {
      const token = await session.token();
      expect(token).toBeTruthy();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars

      // Same token on second call
      expect(await session.token()).toBe(token);
    });

    it('verifyToken() validates correct token', async () => {
      const token = await session.token();
      expect(await session.verifyToken(token)).toBe(true);
      expect(await session.verifyToken('wrong-token')).toBe(false);
    });

    it('regenerateToken() creates new token', async () => {
      const old = await session.token();
      const fresh = await session.regenerateToken();
      expect(fresh).not.toBe(old);
      expect(await session.verifyToken(fresh)).toBe(true);
      expect(await session.verifyToken(old)).toBe(false);
    });
  });

  describe('session ID', () => {
    it('getId() returns the session ID', () => {
      expect(session.getId()).toBe('sess-1');
    });

    it('regenerate() creates new session ID', async () => {
      const oldId = session.getId();
      const newId = await session.regenerate();
      expect(newId).not.toBe(oldId);
      expect(session.getId()).toBe(newId);
    });
  });
});

describe('CARP-015: SessionManager', () => {
  let manager: SessionManager;
  beforeEach(() => { manager = new SessionManager(); });

  it('creates sessions with default driver', () => {
    const session = manager.create();
    expect(session).toBeInstanceOf(Session);
  });

  it('registers and uses custom driver', () => {
    manager.registerDriver('custom', () => new MemorySessionStore('custom-id'));
    const session = manager.create('custom');
    expect(session.getId()).toBe('custom-id');
  });

  it('throws for unknown driver', () => {
    expect(() => manager.create('redis')).toThrow('not registered');
  });

  it('getDefaultDriver()', () => {
    expect(manager.getDefaultDriver()).toBe('memory');
  });
});

describe('CARP-015: SessionStoreRegistry', () => {
  let registry: SessionStoreRegistry;
  beforeEach(() => { registry = new SessionStoreRegistry(); });

  it('resolve() creates store for new session ID', () => {
    const store = registry.resolve('sess-1');
    expect(store.getId()).toBe('sess-1');
  });

  it('resolve() returns same store for same ID', () => {
    const a = registry.resolve('sess-1');
    const b = registry.resolve('sess-1');
    expect(a).toBe(b);
  });

  it('destroy() removes a session', () => {
    registry.resolve('sess-1');
    expect(registry.destroy('sess-1')).toBe(true);
    expect(registry.activeSessions()).not.toContain('sess-1');
  });

  it('activeSessions() lists all IDs', () => {
    registry.resolve('a');
    registry.resolve('b');
    registry.resolve('c');
    expect(registry.activeSessions()).toEqual(['a', 'b', 'c']);
  });

  it('clear() removes all sessions', () => {
    registry.resolve('a');
    registry.resolve('b');
    registry.clear();
    expect(registry.activeSessions()).toHaveLength(0);
  });
});
