import { describe, it, expect } from 'vitest';
import { AzureStorageAdapter } from '../src/index.js';

describe('@carpentry/storage-azure: AzureStorageAdapter', () => {
  it('stores, reads, copies, moves and lists objects', async () => {
    const storage = new AzureStorageAdapter({
      accountName: 'acct',
      container: `uploads-${Date.now()}-${Math.random()}`,
      prefix: 'app',
    });

    await storage.put('avatars/user-1.txt', 'hello', 'text/plain');
    expect(await storage.exists('avatars/user-1.txt')).toBe(true);

    const content = await storage.get('avatars/user-1.txt');
    expect(content?.toString('utf-8')).toBe('hello');

    await storage.copy('avatars/user-1.txt', 'avatars/user-2.txt');
    expect(await storage.getString('avatars/user-2.txt')).toBe('hello');

    await storage.move('avatars/user-2.txt', 'avatars/user-3.txt');
    expect(await storage.exists('avatars/user-2.txt')).toBe(false);
    expect(await storage.exists('avatars/user-3.txt')).toBe(true);

    const listed = await storage.list('avatars');
    expect(listed.map((file) => file.path)).toEqual(['avatars/user-1.txt', 'avatars/user-3.txt']);

    const meta = await storage.metadata('avatars/user-1.txt');
    expect(meta?.contentType).toBe('text/plain');
    expect(await storage.size('avatars/user-1.txt')).toBe(5);

    const tempUrl = await storage.temporaryUrl('avatars/user-1.txt', 60);
    expect(tempUrl).toContain('blob.core.windows.net');
    expect(tempUrl).toContain('se=');

    expect(await storage.delete('avatars/user-1.txt')).toBe(true);
  });
});
