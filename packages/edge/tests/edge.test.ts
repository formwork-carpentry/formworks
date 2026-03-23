/**
 * @module @carpentry/edge
 * @description Comprehensive test suite for EdgeKernel, helpers, and CORS middleware.
 *
 * Test strategy:
 * - Each test creates a fresh EdgeKernel (no shared state)
 * - Mock requests use the Web Standard Request constructor
 * - Covers: routing, params, middleware ordering, error handling, CORS, helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EdgeKernel, edgeJson, edgeText, edgeRedirect, edgeCors,
} from '../src/EdgeKernel.js';
import type { EdgeMiddleware } from '../src/EdgeKernel.js';

// ── Test Helpers ──────────────────────────────────────────

function mockGet(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, { headers });
}
function mockPost(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}
function mockReq(method: string, path: string): Request {
  return new Request(`http://localhost${path}`, { method });
}
async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe('@carpentry/edge: EdgeKernel', () => {
  let kernel: EdgeKernel;
  beforeEach(() => { kernel = new EdgeKernel(); });

  describe('basic routing', () => {
    it('handles GET', async () => {
      kernel.get('/hello', async () => edgeJson({ msg: 'world' }));
      const res = await kernel.handle(mockGet('/hello'));
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ msg: 'world' });
    });

    it('handles POST with JSON body', async () => {
      kernel.post('/items', async (req) => edgeJson({ got: req.body }, 201));
      const res = await kernel.handle(mockPost('/items', { name: 'W' }));
      expect(res.status).toBe(201);
      expect((await json(res)).got).toEqual({ name: 'W' });
    });

    it('handles PUT', async () => {
      kernel.put('/x/:id', async (req) => edgeJson({ updated: req.params['id'] }));
      expect((await json(await kernel.handle(mockReq('PUT', '/x/42')))).updated).toBe('42');
    });

    it('handles DELETE', async () => {
      kernel.delete('/x/:id', async (req) => edgeJson({ deleted: req.params['id'] }));
      expect((await json(await kernel.handle(mockReq('DELETE', '/x/5')))).deleted).toBe('5');
    });

    it('returns 404 for unmatched', async () => {
      kernel.get('/exists', async () => edgeJson({}));
      expect((await kernel.handle(mockGet('/nope'))).status).toBe(404);
    });

    it('returns 404 for wrong method', async () => {
      kernel.get('/only-get', async () => edgeJson({}));
      expect((await kernel.handle(mockReq('POST', '/only-get'))).status).toBe(404);
    });

    it('first match wins', async () => {
      kernel.get('/a', async () => edgeJson({ w: 'first' }));
      kernel.get('/a', async () => edgeJson({ w: 'second' }));
      expect((await json(await kernel.handle(mockGet('/a')))).w).toBe('first');
    });
  });

  describe('route parameters', () => {
    it('extracts single param', async () => {
      kernel.get('/users/:id', async (req) => edgeJson(req.params));
      expect((await json(await kernel.handle(mockGet('/users/42')))).id).toBe('42');
    });

    it('extracts multiple params', async () => {
      kernel.get('/p/:a/c/:b', async (req) => edgeJson(req.params));
      const r = await json(await kernel.handle(mockGet('/p/7/c/99')));
      expect(r).toEqual({ a: '7', b: '99' });
    });
  });

  describe('query parameters', () => {
    it('parses query string', async () => {
      kernel.get('/s', async (req) => edgeJson(req.query));
      expect((await json(await kernel.handle(mockGet('/s?q=test&p=2')))).q).toBe('test');
    });
  });

  describe('middleware', () => {
    it('runs global middleware in order', async () => {
      const log: string[] = [];
      kernel.use(async (r, n) => { log.push('1'); const x = await n(r); log.push('4'); return x; });
      kernel.use(async (r, n) => { log.push('2'); const x = await n(r); log.push('3'); return x; });
      kernel.get('/', async () => { log.push('H'); return edgeJson({}); });
      await kernel.handle(mockGet('/'));
      expect(log).toEqual(['1', '2', 'H', '3', '4']);
    });

    it('can short-circuit (auth guard pattern)', async () => {
      const auth: EdgeMiddleware = async (req, next) => {
        if (!req.headers['authorization']) return edgeJson({ error: 'Unauthorized' }, 401);
        return next(req);
      };
      kernel.use(auth);
      kernel.get('/secret', async () => edgeJson({ data: 'classified' }));

      expect((await kernel.handle(mockGet('/secret'))).status).toBe(401);
      expect((await kernel.handle(mockGet('/secret', { authorization: 'Bearer x' }))).status).toBe(200);
    });

    it('can modify response (add headers)', async () => {
      kernel.use(async (r, n) => {
        const res = await n(r);
        res.headers['x-powered-by'] = 'Carpenter';
        return res;
      });
      kernel.get('/', async () => edgeJson({}));
      const res = await kernel.handle(mockGet('/'));
      expect(res.headers.get('x-powered-by')).toBe('Carpenter');
    });

    it('route middleware runs after global', async () => {
      const log: string[] = [];
      kernel.use(async (r, n) => { log.push('G'); return n(r); });
      kernel.route('GET', '/x', async () => { log.push('H'); return edgeJson({}); }, [
        async (r, n) => { log.push('R'); return n(r); },
      ]);
      await kernel.handle(mockGet('/x'));
      expect(log).toEqual(['G', 'R', 'H']);
    });
  });

  describe('error handling', () => {
    it('catches handler errors → 500', async () => {
      kernel.get('/crash', async () => { throw new Error('boom'); });
      const res = await kernel.handle(mockGet('/crash'));
      expect(res.status).toBe(500);
      expect((await json(res)).error).toBe('boom');
    });

    it('catches middleware errors', async () => {
      kernel.use(async () => { throw new Error('mw fail'); });
      kernel.get('/', async () => edgeJson({}));
      expect((await kernel.handle(mockGet('/'))).status).toBe(500);
    });

    it('custom 404 handler', async () => {
      kernel.onNotFound(async (req) => edgeJson({ error: 'Not here', path: req.path }, 404));
      const res = await kernel.handle(mockGet('/nope'));
      expect((await json(res)).path).toBe('/nope');
    });
  });

  describe('edgeCors', () => {
    it('preflight returns 204 with CORS headers', async () => {
      kernel.use(edgeCors({ origin: 'https://app.com' }));
      kernel.get('/', async () => edgeJson({}));
      const res = await kernel.handle(mockReq('OPTIONS', '/'));
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.com');
    });

    it('adds origin to normal responses', async () => {
      kernel.use(edgeCors());
      kernel.get('/', async () => edgeJson({}));
      const res = await kernel.handle(mockGet('/'));
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('response helpers', () => {
    it('edgeJson', () => {
      const r = edgeJson({ a: 1 }, 201, { 'x-c': 'v' });
      expect(r.status).toBe(201);
      expect(r.headers['content-type']).toBe('application/json');
      expect(r.headers['x-c']).toBe('v');
    });
    it('edgeText', () => {
      const r = edgeText('hi');
      expect(r.headers['content-type']).toBe('text/plain');
      expect(r.body).toBe('hi');
    });
    it('edgeRedirect defaults 302', () => {
      expect(edgeRedirect('/new').status).toBe(302);
      expect(edgeRedirect('/new', 301).status).toBe(301);
    });
  });

  describe('getRouteCount', () => {
    it('tracks routes', () => {
      expect(kernel.getRouteCount()).toBe(0);
      kernel.get('/a', async () => edgeJson({}));
      kernel.post('/b', async () => edgeJson({}));
      expect(kernel.getRouteCount()).toBe(2);
    });
  });
});
