import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient, FakeTransport } from '../src/index.js';

describe('@carpentry/http-client: HttpClient + FakeTransport', () => {
  let transport: FakeTransport;
  let client: HttpClient;

  beforeEach(() => {
    transport = new FakeTransport();
    client = new HttpClient(transport).withBaseUrl('https://api.example.com');
  });

  describe('GET requests', () => {
    it('sends GET request', async () => {
      transport.queue({ status: 200, body: { users: [] } });
      const res = await client.get('/users').send();

      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
      expect(res.json<{ users: unknown[] }>().users).toEqual([]);
      transport.assertSent('GET', '/users');
    });

    it('sends query parameters', async () => {
      transport.queue({ status: 200, body: [] });
      await client.get('/users', { page: '1', limit: '10' }).send();

      const recorded = transport.getRecorded()[0];
      expect(recorded.query).toEqual({ page: '1', limit: '10' });
    });
  });

  describe('POST requests', () => {
    it('sends POST with body', async () => {
      transport.queue({ status: 201, body: { id: 1, name: 'Alice' } });
      const res = await client.post('/users', { name: 'Alice', email: 'a@b.com' }).asJson().send();

      expect(res.status).toBe(201);
      transport.assertSent('POST', '/users');
      transport.assertSentWithBody((b: unknown) => (b as { name: string }).name === 'Alice');
    });
  });

  describe('PUT/PATCH/DELETE', () => {
    it('PUT request', async () => {
      transport.queue({ status: 200, body: {} });
      await client.put('/users/1', { name: 'Updated' }).send();
      transport.assertSent('PUT', '/users/1');
    });

    it('PATCH request', async () => {
      transport.queue({ status: 200, body: {} });
      await client.patch('/users/1', { role: 'admin' }).send();
      transport.assertSent('PATCH', '/users/1');
    });

    it('DELETE request', async () => {
      transport.queue({ status: 204, body: null });
      await client.delete('/users/1').send();
      transport.assertSent('DELETE', '/users/1');
    });
  });

  describe('headers', () => {
    it('withToken() sets bearer auth', async () => {
      transport.queue({ status: 200, body: {} });
      await client.withToken('my-secret-token').get('/me').send();
      transport.assertSentWithHeader('Authorization', 'Bearer my-secret-token');
    });

    it('withHeaders() sets custom headers', async () => {
      transport.queue({ status: 200, body: {} });
      client.withHeaders({ 'X-Custom': 'value' });
      await client.get('/test').send();
      transport.assertSentWithHeader('X-Custom', 'value');
    });

    it('per-request header', async () => {
      transport.queue({ status: 200, body: {} });
      await client.get('/test').header('X-Request-Id', 'abc-123').send();
      transport.assertSentWithHeader('X-Request-Id', 'abc-123');
    });
  });

  describe('response helpers', () => {
    it('json() returns parsed body', async () => {
      transport.queue({ status: 200, body: { message: 'hello' } });
      const res = await client.get('/test').send();
      expect(res.json<{ message: string }>().message).toBe('hello');
    });

    it('text() returns string body', async () => {
      transport.queue({ status: 200, body: 'plain text' });
      const res = await client.get('/test').send();
      expect(res.text()).toBe('plain text');
    });

    it('ok is false for 4xx/5xx', async () => {
      transport.queue({ status: 404, body: { error: 'Not found' } });
      const res = await client.get('/missing').send();
      expect(res.ok).toBe(false);
      expect(res.status).toBe(404);
    });
  });

  describe('queued responses', () => {
    it('returns responses in FIFO order', async () => {
      transport.queue({ status: 200, body: { page: 1 } });
      transport.queue({ status: 200, body: { page: 2 } });

      const r1 = await client.get('/page1').send();
      const r2 = await client.get('/page2').send();

      expect(r1.json<{ page: number }>().page).toBe(1);
      expect(r2.json<{ page: number }>().page).toBe(2);
    });

    it('uses default response when queue is empty', async () => {
      transport.setDefault({ status: 500, body: { error: 'Server error' } });
      const res = await client.get('/anything').send();
      expect(res.status).toBe(500);
    });

    it('dynamic response based on request', async () => {
      transport.queue((req) => ({
        status: 200,
        body: { echo: req.url },
      }));

      const res = await client.get('/echo-test').send();
      expect(res.json<{ echo: string }>().echo).toContain('echo-test');
    });
  });

  describe('base URL', () => {
    it('prepends base URL to relative paths', async () => {
      transport.queue({ status: 200, body: {} });
      await client.get('/users').send();
      expect(transport.getRecorded()[0].url).toBe('https://api.example.com/users');
    });

    it('uses absolute URLs as-is', async () => {
      transport.queue({ status: 200, body: {} });
      await client.get('https://other.com/api').send();
      expect(transport.getRecorded()[0].url).toBe('https://other.com/api');
    });
  });

  describe('assertions', () => {
    it('assertNotSent()', async () => {
      transport.assertNotSent('POST');
      transport.assertNothingSent();
    });

    it('assertSentCount()', async () => {
      transport.queue({ status: 200, body: {} });
      transport.queue({ status: 200, body: {} });
      await client.get('/a').send();
      await client.get('/b').send();
      transport.assertSentCount(2);
    });

    it('reset() clears state', async () => {
      transport.queue({ status: 200, body: {} });
      await client.get('/a').send();
      transport.reset();
      transport.assertNothingSent();
    });
  });
});
