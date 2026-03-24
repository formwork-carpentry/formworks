import { describe, it, expect } from 'vitest';
import { HashManager } from '../../../src/auth/hash/HashManager.js';

describe('auth/hash/HashManager', () => {
  it('creates and verifies a hash with the default driver', async () => {
    const hash = new HashManager();
    const hashed = await hash.make('secret');

    expect(hashed).toContain('$sha256$');
    expect(await hash.check('secret', hashed)).toBe(true);
    expect(await hash.check('wrong', hashed)).toBe(false);
  });

  it('returns false for invalid hash payloads', async () => {
    const hash = new HashManager();
    expect(await hash.check('secret', 'not-a-hash')).toBe(false);
  });

  it('does not require rehash for default sha256 driver', () => {
    const hash = new HashManager();
    expect(hash.needsRehash('$sha256$deadbeef$feedface')).toBe(false);
  });
});
