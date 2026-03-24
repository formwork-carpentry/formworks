import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════
// ISR CACHE (CARP-076)
// ═══════════════════════════════════════════════════════════

import { IsrCache } from '../packages/edge/src/isr.js';

describe('IsrCache', () => {
  let isr: IsrCache;

  beforeEach(() => { isr = new IsrCache({ defaultTtl: 10, swrSeconds: 5 }); });

  it('caches a generated page', async () => {
    let calls = 0;
    const gen = async () => { calls++; return { body: '<h1>Hello</h1>', tags: ['posts'] }; };

    const r1 = await isr.handle('/home', gen);
    expect(r1.body).toBe('<h1>Hello</h1>');
    expect(r1.status).toBe(200);
    expect(calls).toBe(1);

    const r2 = await isr.handle('/home', gen);
    expect(r2.body).toBe('<h1>Hello</h1>');
    expect(calls).toBe(1); // Served from cache
  });

  it('sets Cache-Control and Surrogate-Key headers', async () => {
    const result = await isr.handle('/page', async () => ({
      body: 'content', tags: ['posts', 'post:1'],
    }));
    expect(result.headers['cache-control']).toContain('max-age=10');
    expect(result.headers['cache-control']).toContain('stale-while-revalidate=5');
    expect(result.headers['Surrogate-Key']).toBe('posts post:1');
  });

  it('purges by tag', async () => {
    await isr.handle('/a', async () => ({ body: 'a', tags: ['posts'] }));
    await isr.handle('/b', async () => ({ body: 'b', tags: ['posts', 'users'] }));
    await isr.handle('/c', async () => ({ body: 'c', tags: ['users'] }));

    const purged = isr.purgeTag('posts');
    expect(purged).toBe(2);
    expect(isr.stats().size).toBe(1);
  });

  it('purges by key', async () => {
    await isr.handle('/page', async () => ({ body: 'x' }));
    expect(isr.purgeKey('/page')).toBe(true);
    expect(isr.purgeKey('/nonexistent')).toBe(false);
  });

  it('purges all', async () => {
    await isr.handle('/a', async () => ({ body: 'a' }));
    await isr.handle('/b', async () => ({ body: 'b' }));
    expect(isr.purgeAll()).toBe(2);
    expect(isr.stats().size).toBe(0);
  });

  it('reports stats', async () => {
    await isr.handle('/x', async () => ({ body: 'x', tags: ['t'] }));
    const stats = isr.stats();
    expect(stats.size).toBe(1);
    expect(stats.keys).toEqual(['/x']);
  });
});

// ═══════════════════════════════════════════════════════════
// EDGE MIDDLEWARE (CARP-077)
// ═══════════════════════════════════════════════════════════

import { edgeGeo, edgeABTest, edgeBotGuard } from '../packages/edge/src/middleware.js';
import type { EdgeRequest, EdgeResponse } from '@carpentry/core/contracts';

function makeEdgeReq(overrides: Partial<EdgeRequest> = {}): EdgeRequest {
  return {
    method: 'GET', url: 'http://localhost/', headers: {}, params: {}, query: {}, body: null,
    ...overrides,
  };
}

const passThrough = async (req: EdgeRequest): Promise<EdgeResponse> => ({
  status: 200, headers: { 'content-type': 'text/html' }, body: 'OK',
});

describe('edgeGeo', () => {
  const mw = edgeGeo({ routes: { US: '/us', DE: '/de' }, fallback: '/en' });

  it('redirects US user to /us', async () => {
    const req = makeEdgeReq({ headers: { 'cf-ipcountry': 'US' } });
    const res = await mw(req, passThrough);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('/us');
  });

  it('redirects DE user to /de', async () => {
    const req = makeEdgeReq({ headers: { 'cf-ipcountry': 'DE' } });
    const res = await mw(req, passThrough);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('/de');
  });

  it('falls back for unknown country', async () => {
    const req = makeEdgeReq({ headers: { 'cf-ipcountry': 'BR' } });
    const res = await mw(req, passThrough);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('/en');
  });

  it('passes through if already on correct path', async () => {
    const req = makeEdgeReq({ url: 'http://localhost/us/page', headers: { 'cf-ipcountry': 'US' } });
    const res = await mw(req, passThrough);
    expect(res.status).toBe(200);
  });
});

describe('edgeABTest', () => {
  const mw = edgeABTest({ experiment: 'checkout', variants: ['control', 'variant-a'] });

  it('assigns a variant and sets cookie', async () => {
    const req = makeEdgeReq();
    const res = await mw(req, passThrough);
    expect(res.headers['set-cookie']).toContain('ab-checkout=');
    expect(res.headers['x-ab-variant']).toMatch(/control|variant-a/);
  });

  it('uses sticky cookie on subsequent requests', async () => {
    const req = makeEdgeReq({ headers: { cookie: 'ab-checkout=variant-a' } });
    const res = await mw(req, passThrough);
    expect(res.headers['x-ab-variant']).toBe('variant-a');
  });

  it('adds experiment and variant to request headers', async () => {
    const req = makeEdgeReq();
    await mw(req, async (r) => {
      expect(r.headers['x-ab-experiment']).toBe('checkout');
      expect(r.headers['x-ab-variant']).toBeDefined();
      return passThrough(r);
    });
  });
});

describe('edgeBotGuard', () => {
  const mw = edgeBotGuard({ allowSearchEngines: true });

  it('blocks known scraper bots', async () => {
    const req = makeEdgeReq({ headers: { 'user-agent': 'Mozilla/5.0 (compatible; AhrefsBot/7.0)' } });
    const res = await mw(req, passThrough);
    expect(res.status).toBe(403);
  });

  it('allows Googlebot when search engines allowed', async () => {
    const req = makeEdgeReq({ headers: { 'user-agent': 'Googlebot/2.1' } });
    const res = await mw(req, passThrough);
    expect(res.status).toBe(200);
  });

  it('allows normal browsers', async () => {
    const req = makeEdgeReq({ headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0' } });
    const res = await mw(req, passThrough);
    expect(res.status).toBe(200);
  });

  it('blocks search engines when configured', async () => {
    const strict = edgeBotGuard({ allowSearchEngines: false, blockedAgents: ['googlebot'] });
    const req = makeEdgeReq({ headers: { 'user-agent': 'Googlebot/2.1' } });
    const res = await strict(req, passThrough);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════
// UNIX SOCKET TRANSPORT (CARP-073)
// ═══════════════════════════════════════════════════════════

import { UnixSocketTransport, createUnixSocketServer } from '../src/bridge/unix-socket.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unlinkSync } from 'node:fs';

describe('UnixSocketTransport', () => {
  const sockPath = join(tmpdir(), 'carpenter-test-' + process.pid + '.sock');

  it('sends and receives via unix socket', async () => {
    const server = createUnixSocketServer(sockPath, async (msg) => {
      if (msg.method === 'greet') {
        return { data: { message: 'Hello, ' + (msg.payload as Record<string, string>)['name'] } };
      }
      return { error: { code: 'NOT_FOUND', message: 'Unknown method' } };
    });

    try {
      const transport = new UnixSocketTransport(sockPath);
      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      const response = await transport.send({
        id: 'req-1', service: 'greeter', method: 'greet',
        payload: { name: 'Alice' }, timestamp: Date.now(),
      });

      expect(response.data).toEqual({ message: 'Hello, Alice' });

      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    } finally {
      server.close();
      try { unlinkSync(sockPath); } catch { /* ignore */ }
    }
  });
});
