import { describe, it, expect, vi } from 'vitest';
import { S3StorageAdapter } from '../src/index.js';

function createMockFetch(opts: { ok?: boolean; status?: number; body?: ArrayBuffer; headers?: Record<string, string> } = {}): typeof fetch {
  const { ok = true, status = 200, body = new ArrayBuffer(0), headers = {} } = opts;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    arrayBuffer: () => Promise.resolve(body),
    headers: new Headers(headers),
  }) as unknown as typeof fetch;
}

describe('S3StorageAdapter', () => {
  const baseConfig = {
    bucket: 'test-bucket',
    region: 'us-east-1',
    accessKeyId: 'AKID',
    secretAccessKey: 'SECRET',
  };

  it('should put a file', async () => {
    const mockFetch = createMockFetch();
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    await s3.put('file.txt', 'hello', 'text/plain');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('file.txt'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('should get a file', async () => {
    const encoder = new TextEncoder();
    const body = encoder.encode('hello').buffer;
    const mockFetch = createMockFetch({ body: body as ArrayBuffer });
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    const result = await s3.get('file.txt');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should throw on failed get', async () => {
    const mockFetch = createMockFetch({ ok: false, status: 404 });
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    await expect(s3.get('missing.txt')).rejects.toThrow('S3 GET failed');
  });

  it('should check if file exists', async () => {
    const mockFetch = createMockFetch();
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    expect(await s3.exists('file.txt')).toBe(true);
  });

  it('should return false for non-existing file', async () => {
    const mockFetch = createMockFetch({ ok: false, status: 404 });
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    expect(await s3.exists('nope.txt')).toBe(false);
  });

  it('should delete a file', async () => {
    const mockFetch = createMockFetch();
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    expect(await s3.delete('file.txt')).toBe(true);
  });

  it('should return a URL for a key', () => {
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: createMockFetch() });
    const url = s3.url('photos/pic.jpg');
    expect(url).toContain('pic.jpg');
    expect(url).toContain('test-bucket');
  });

  it('should copy a file', async () => {
    const mockFetch = createMockFetch();
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    await s3.copy('source.txt', 'dest.txt');
    const call = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers['x-amz-copy-source']).toBe('/test-bucket/source.txt');
  });

  it('should get metadata', async () => {
    const mockFetch = createMockFetch({
      headers: { 'content-length': '1024', 'content-type': 'text/plain', 'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT' },
    });
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    const meta = await s3.metadata('file.txt');
    expect(meta).not.toBeNull();
    expect(meta!.size).toBe(1024);
    expect(meta!.contentType).toBe('text/plain');
  });

  it('should return null for metadata of non-existing file', async () => {
    const mockFetch = createMockFetch({ ok: false, status: 404 });
    const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: mockFetch });
    expect(await s3.metadata('nope.txt')).toBeNull();
  });

  it('should use path-style URLs when configured', () => {
    const s3 = new S3StorageAdapter({
      ...baseConfig,
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      fetchFn: createMockFetch(),
    });
    const url = s3.url('file.txt');
    expect(url).toBe('http://localhost:9000/test-bucket/file.txt');
  });
});
