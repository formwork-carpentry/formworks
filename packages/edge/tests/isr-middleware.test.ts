import { describe, it, expect, beforeEach } from 'vitest';
import { IsrCache } from '../src/isr.js';
import { edgeGeo, edgeABTest, edgeBotGuard } from '../src/middleware.js';
import type { EdgeRequest, EdgeResponse } from '@carpentry/core/contracts';

function makeEdgeReq(overrides: Partial<EdgeRequest> = {}): EdgeRequest {
  return {
    method: 'GET',
    url: 'http://localhost/',
    headers: {},
    params: {},
    query: {},
    body: null,
    ...overrides,
  };
}

const passThrough = async (_req: EdgeRequest): Promise<EdgeResponse> => ({
  status: 200,
  headers: { 'content-type': 'text/html' },
  body: 'OK',
});

describe('edge/IsrCache', () => {
  let isr: IsrCache;

  beforeEach(() => {
    isr = new IsrCache({ defaultTtl: 10, swrSeconds: 5 });
  });

  it('caches generated pages', async () => {
    let calls = 0;
    const gen = async () => {
      calls++;
      return { body: '<h1>Hello</h1>', tags: ['posts'] };
    };

    const r1 = await isr.handle('/home', gen);
    const r2 = await isr.handle('/home', gen);

    expect(r1.body).toBe('<h1>Hello</h1>');
    expect(r1.status).toBe(200);
    expect(r2.body).toBe('<h1>Hello</h1>');
    expect(calls).toBe(1);
  });

  it('sets cache and surrogate headers', async () => {
    const result = await isr.handle('/page', async () => ({ body: 'content', tags: ['posts', 'post:1'] }));
    expect(result.headers['cache-control']).toContain('max-age=10');
    expect(result.headers['cache-control']).toContain('stale-while-revalidate=5');
    expect(result.headers['Surrogate-Key']).toBe('posts post:1');
  });

  it('purges by tag, key and full cache', async () => {
    await isr.handle('/a', async () => ({ body: 'a', tags: ['posts'] }));
    await isr.handle('/b', async () => ({ body: 'b', tags: ['posts', 'users'] }));
    await isr.handle('/c', async () => ({ body: 'c', tags: ['users'] }));

    expect(isr.purgeTag('posts')).toBe(2);
    expect(isr.stats().size).toBe(1);

    await isr.handle('/page', async () => ({ body: 'x' }));
    expect(isr.purgeKey('/page')).toBe(true);
    expect(isr.purgeKey('/nonexistent')).toBe(false);

    expect(isr.purgeAll()).toBe(1);
    expect(isr.stats().size).toBe(0);
  });

  it('reports stats', async () => {
    await isr.handle('/x', async () => ({ body: 'x', tags: ['t'] }));
    const stats = isr.stats();
    expect(stats.size).toBe(1);
    expect(stats.keys).toEqual(['/x']);
  });
});

describe('edge/middleware', () => {
  describe('edgeGeo', () => {
    const mw = edgeGeo({ routes: { US: '/us', DE: '/de' }, fallback: '/en' });

    it('redirects country-based traffic and falls back', async () => {
      const us = await mw(makeEdgeReq({ headers: { 'cf-ipcountry': 'US' } }), passThrough);
      const de = await mw(makeEdgeReq({ headers: { 'cf-ipcountry': 'DE' } }), passThrough);
      const br = await mw(makeEdgeReq({ headers: { 'cf-ipcountry': 'BR' } }), passThrough);

      expect(us.status).toBe(302);
      expect(us.headers['location']).toContain('/us');
      expect(de.headers['location']).toContain('/de');
      expect(br.headers['location']).toContain('/en');
    });

    it('passes through when already on target path', async () => {
      const req = makeEdgeReq({ url: 'http://localhost/us/page', headers: { 'cf-ipcountry': 'US' } });
      const res = await mw(req, passThrough);
      expect(res.status).toBe(200);
    });
  });

  describe('edgeABTest', () => {
    const mw = edgeABTest({ experiment: 'checkout', variants: ['control', 'variant-a'] });

    it('assigns sticky variants and propagates headers', async () => {
      const first = await mw(makeEdgeReq(), passThrough);
      expect(first.headers['set-cookie']).toContain('ab-checkout=');
      expect(first.headers['x-ab-variant']).toMatch(/control|variant-a/);

      const sticky = await mw(makeEdgeReq({ headers: { cookie: 'ab-checkout=variant-a' } }), passThrough);
      expect(sticky.headers['x-ab-variant']).toBe('variant-a');

      await mw(makeEdgeReq(), async (r) => {
        expect(r.headers['x-ab-experiment']).toBe('checkout');
        expect(r.headers['x-ab-variant']).toBeDefined();
        return passThrough(r);
      });
    });
  });

  describe('edgeBotGuard', () => {
    const mw = edgeBotGuard({ allowSearchEngines: true });

    it('blocks scrapers and allows permitted user agents', async () => {
      const scraper = await mw(
        makeEdgeReq({ headers: { 'user-agent': 'Mozilla/5.0 (compatible; AhrefsBot/7.0)' } }),
        passThrough,
      );
      const google = await mw(makeEdgeReq({ headers: { 'user-agent': 'Googlebot/2.1' } }), passThrough);
      const browser = await mw(
        makeEdgeReq({ headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0' } }),
        passThrough,
      );

      expect(scraper.status).toBe(403);
      expect(google.status).toBe(200);
      expect(browser.status).toBe(200);
    });

    it('blocks search engines when configured', async () => {
      const strict = edgeBotGuard({ allowSearchEngines: false, blockedAgents: ['googlebot'] });
      const res = await strict(makeEdgeReq({ headers: { 'user-agent': 'Googlebot/2.1' } }), passThrough);
      expect(res.status).toBe(403);
    });
  });
});
