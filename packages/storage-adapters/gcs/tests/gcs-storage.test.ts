import { describe, it, expect } from 'vitest';
import { GcsStorageAdapter } from '../src/index.js';

describe('@carpentry/storage-gcs: GcsStorageAdapter', () => {
  it('stores, reads, copies, moves and lists objects', async () => {
    const storage = new GcsStorageAdapter({
      bucket: `bucket-${Date.now()}-${Math.random()}`,
      prefix: 'site',
    });

    await storage.put('assets/logo.svg', '<svg/>', 'image/svg+xml');
    expect(await storage.exists('assets/logo.svg')).toBe(true);

    const content = await storage.get('assets/logo.svg');
    expect(content?.toString('utf-8')).toBe('<svg/>');

    await storage.copy('assets/logo.svg', 'assets/logo-copy.svg');
    expect(await storage.getString('assets/logo-copy.svg')).toBe('<svg/>');

    await storage.move('assets/logo-copy.svg', 'assets/logo-final.svg');
    expect(await storage.exists('assets/logo-copy.svg')).toBe(false);
    expect(await storage.exists('assets/logo-final.svg')).toBe(true);

    const listed = await storage.list('assets');
    expect(listed.map((file) => file.path)).toEqual(['assets/logo-final.svg', 'assets/logo.svg']);

    const meta = await storage.metadata('assets/logo.svg');
    expect(meta?.contentType).toBe('image/svg+xml');
    expect(await storage.mimeType('assets/logo.svg')).toBe('image/svg+xml');

    const tempUrl = await storage.temporaryUrl('assets/logo.svg', 300);
    expect(tempUrl).toContain('storage.googleapis.com');
    expect(tempUrl).toContain('expires=');

    expect(await storage.delete('assets/logo.svg')).toBe(true);
  });
});
