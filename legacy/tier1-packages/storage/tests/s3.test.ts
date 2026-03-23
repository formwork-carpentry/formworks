/**
 * @module @carpentry/storage
 * @description Tests for S3StorageAdapter using mock fetch.
 *
 * Test strategy:
 * - Mock fetch captures requests (URL, method, headers) for assertion
 * - Returns configurable responses for each S3 operation
 * - No real AWS calls
 */

import { describe, it, expect } from 'vitest';
import { S3StorageAdapter } from '../src/adapters/S3StorageAdapter.js';

interface Captured { url: string; method: string; headers: Record<string, string> }

function mockS3Fetch(status = 200, body = ''): { fetch: typeof fetch; captured: Captured } {
  const captured: Captured = { url: '', method: '', headers: {} };
  const f: typeof fetch = async (url, init) => {
    captured.url = String(url);
    captured.method = init?.method ?? 'GET';
    captured.headers = Object.fromEntries(Object.entries(init?.headers ?? {}));
    // 204/304 must not have a body per HTTP spec
    const responseBody = (status === 204 || status === 304) ? null : body;
    return new Response(responseBody, {
      status,
      headers: {
        'content-length': String(body.length),
        'content-type': 'application/octet-stream',
        'last-modified': new Date().toUTCString(),
      },
    });
  };
  return { fetch: f, captured };
}

describe('@carpentry/storage: S3StorageAdapter', () => {
  const baseConfig = {
    bucket: 'my-bucket',
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  };

  describe('put', () => {
    it('sends PUT to correct S3 URL', async () => {
      const { fetch, captured } = mockS3Fetch(200);
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });

      await s3.put('uploads/photo.jpg', 'binary-data', 'image/jpeg');

      expect(captured.method).toBe('PUT');
      expect(captured.url).toContain('my-bucket');
      expect(captured.url).toContain('uploads/photo.jpg');
      expect(captured.headers['Content-Type']).toBe('image/jpeg');
    });

    it('includes auth header', async () => {
      const { fetch, captured } = mockS3Fetch(200);
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });

      await s3.put('file.txt', 'content');
      expect(captured.headers['Authorization']).toContain('AWS4-HMAC-SHA256');
      expect(captured.headers['Authorization']).toContain('AKIAIOSFODNN7EXAMPLE');
    });
  });

  describe('get', () => {
    it('fetches file content', async () => {
      const { fetch } = mockS3Fetch(200, 'file-content-here');
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });

      const buf = await s3.get('docs/readme.txt');
      expect(buf.toString()).toBe('file-content-here');
    });

    it('throws on 404', async () => {
      const { fetch } = mockS3Fetch(404, '');
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });

      await expect(s3.get('missing.txt')).rejects.toThrow('S3 GET failed');
    });
  });

  describe('exists', () => {
    it('returns true for existing files', async () => {
      const { fetch } = mockS3Fetch(200);
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });
      expect(await s3.exists('file.txt')).toBe(true);
    });

    it('returns false for missing files', async () => {
      const { fetch } = mockS3Fetch(404);
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });
      expect(await s3.exists('missing.txt')).toBe(false);
    });
  });

  describe('delete', () => {
    it('sends DELETE request', async () => {
      const { fetch, captured } = mockS3Fetch(204);
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });

      const result = await s3.delete('temp.txt');
      expect(result).toBe(true);
      expect(captured.method).toBe('DELETE');
    });
  });

  describe('url', () => {
    it('generates virtual-hosted style URL by default', () => {
      const { fetch } = mockS3Fetch();
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });
      const url = s3.url('photos/cat.jpg');
      expect(url).toContain('my-bucket');
      expect(url).toContain('photos/cat.jpg');
    });

    it('generates path-style URL when forcePathStyle is true', () => {
      const { fetch } = mockS3Fetch();
      const s3 = new S3StorageAdapter({ ...baseConfig, forcePathStyle: true, fetchFn: fetch });
      const url = s3.url('photos/cat.jpg');
      expect(url).toContain('/my-bucket/photos/cat.jpg');
    });
  });

  describe('metadata', () => {
    it('returns file metadata from HEAD request', async () => {
      const { fetch } = mockS3Fetch(200, 'x'.repeat(1024));
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });

      const meta = await s3.metadata('file.txt');
      expect(meta).not.toBeNull();
      expect(meta!.size).toBe(1024);
      expect(meta!.contentType).toBe('application/octet-stream');
      expect(meta!.lastModified).toBeInstanceOf(Date);
    });

    it('returns null for missing files', async () => {
      const { fetch } = mockS3Fetch(404);
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });
      expect(await s3.metadata('missing.txt')).toBeNull();
    });
  });

  describe('copy', () => {
    it('sends PUT with x-amz-copy-source header', async () => {
      const { fetch, captured } = mockS3Fetch(200);
      const s3 = new S3StorageAdapter({ ...baseConfig, fetchFn: fetch });

      await s3.copy('original.txt', 'backup.txt');
      expect(captured.method).toBe('PUT');
      expect(captured.headers['x-amz-copy-source']).toBe('/my-bucket/original.txt');
    });
  });

  describe('custom endpoint (MinIO/R2)', () => {
    it('uses custom endpoint URL', async () => {
      const { fetch, captured } = mockS3Fetch(200);
      const s3 = new S3StorageAdapter({
        ...baseConfig,
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        fetchFn: fetch,
      });

      await s3.put('test.txt', 'data');
      expect(captured.url).toContain('http://localhost:9000/my-bucket/test.txt');
    });
  });
});
