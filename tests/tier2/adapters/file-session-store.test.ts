import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { FileSessionStore } from '../../../src/session/FileSessionStore.js';

const TEST_DIR = `/tmp/carpenter-test-session-${Date.now()}`;

async function cleanup(): Promise<void> {
  await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
}

describe('tier2/adapters/FileSessionStore', () => {
  let store: FileSessionStore;
  const dir = join(TEST_DIR, 'sessions');

  beforeEach(async () => {
    store = new FileSessionStore({ directory: dir, sessionId: 'test-session-123' });
    await fs.mkdir(dir, { recursive: true });
  });

  afterEach(cleanup);

  it('stores, gets and forgets values', async () => {
    await store.put('user_id', 42);
    expect(await store.get<number>('user_id')).toBe(42);
    expect(await store.get('nope')).toBeNull();

    await store.put('temp', 'val');
    await store.forget('temp');
    expect(await store.get('temp')).toBeNull();
  });

  it('flushes all data', async () => {
    await store.put('a', 1);
    await store.put('b', 2);
    await store.flush();
    expect(await store.get('a')).toBeNull();
  });

  it('provides and regenerates session IDs', async () => {
    expect(store.getSessionId()).toBe('test-session-123');

    await store.put('preserved', 'data');
    const newId = await store.regenerate();
    expect(newId).not.toBe('test-session-123');
    expect(store.getSessionId()).toBe(newId);
    expect(await store.get('preserved')).toBe('data');
  });

  it('persists to disk for the same session id', async () => {
    await store.put('persistent', 'value');

    const store2 = new FileSessionStore({ directory: dir, sessionId: 'test-session-123' });
    expect(await store2.get('persistent')).toBe('value');
  });

  it('garbage collects expired sessions', async () => {
    const expired = new FileSessionStore({ directory: dir, sessionId: 'expired', ttlMinutes: 0 });
    await expired.put('old', 'data');

    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const path = join(dir, file);
      const raw = await fs.readFile(path, 'utf-8');
      const data = JSON.parse(raw) as { lastAccessed: number };
      data.lastAccessed = 0;
      await fs.writeFile(path, JSON.stringify(data));
    }

    const cleaned = await store.gc();
    expect(cleaned).toBeGreaterThanOrEqual(1);
  });
});
