/**
 * @module @carpentry/http
 * @description Tests for HTTP Request object (CARP-009)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Request } from '../src/request/Request.js';

/** Helper to create a Web Standard Request for testing */
function makeRaw(
  url: string,
  options: RequestInit & { method?: string } = {},
): globalThis.Request {
  return new globalThis.Request(url, options);
}

describe('CARP-009: HTTP Request Object', () => {
  describe('basic accessors', () => {
    it('returns the HTTP method uppercased', () => {
      const req = new Request(makeRaw('http://localhost/', { method: 'post' }));
      expect(req.method()).toBe('POST');
    });

    it('returns the path without query string', () => {
      const req = new Request(makeRaw('http://localhost/users?page=1'));
      expect(req.path()).toBe('/users');
    });

    it('returns the full URL', () => {
      const url = 'http://localhost:3000/api/posts?limit=10';
      const req = new Request(makeRaw(url));
      expect(req.url()).toBe(url);
    });
  });

  describe('headers', () => {
    it('reads a specific header (case-insensitive)', () => {
      const raw = makeRaw('http://localhost/', {
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'test' },
      });
      const req = new Request(raw);
      expect(req.header('content-type')).toBe('application/json');
      expect(req.header('x-custom')).toBe('test');
    });

    it('returns undefined for missing headers', () => {
      const req = new Request(makeRaw('http://localhost/'));
      expect(req.header('x-nonexistent')).toBeUndefined();
    });

    it('returns all headers as a dictionary', () => {
      const raw = makeRaw('http://localhost/', {
        headers: { 'Accept': 'text/html', 'X-Request-Id': 'abc' },
      });
      const req = new Request(raw);
      const headers = req.headers();
      expect(headers['accept']).toBe('text/html');
      expect(headers['x-request-id']).toBe('abc');
    });
  });

  describe('query parameters', () => {
    it('reads query params', () => {
      const req = new Request(makeRaw('http://localhost/search?q=hello&page=2'));
      expect(req.query('q')).toBe('hello');
      expect(req.query('page')).toBe('2');
    });

    it('returns undefined for missing query params', () => {
      const req = new Request(makeRaw('http://localhost/'));
      expect(req.query('missing')).toBeUndefined();
    });
  });

  describe('route parameters', () => {
    it('reads route params set by the router', () => {
      const req = new Request(makeRaw('http://localhost/users/42'), { id: '42' });
      expect(req.param('id')).toBe('42');
    });

    it('returns undefined for missing route params', () => {
      const req = new Request(makeRaw('http://localhost/'));
      expect(req.param('id')).toBeUndefined();
    });

    it('supports setRouteParams()', () => {
      const req = new Request(makeRaw('http://localhost/'));
      req.setRouteParams({ slug: 'hello-world' });
      expect(req.param('slug')).toBe('hello-world');
    });
  });

  describe('body parsing', () => {
    it('parses JSON body', async () => {
      const raw = makeRaw('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', age: 30 }),
      });
      const req = new Request(raw);
      await req.parseBody();

      expect(req.body<{ name: string; age: number }>()).toEqual({ name: 'Alice', age: 30 });
    });

    it('parses URL-encoded body', async () => {
      const raw = makeRaw('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'username=bob&password=secret',
      });
      const req = new Request(raw);
      await req.parseBody();

      expect(req.input('username')).toBe('bob');
      expect(req.input('password')).toBe('secret');
    });

    it('returns null body for unsupported content types', async () => {
      const raw = makeRaw('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello',
      });
      const req = new Request(raw);
      await req.parseBody();

      expect(req.body()).toBeNull();
    });
  });

  describe('input() — merged body + query', () => {
    it('returns body values', async () => {
      const raw = makeRaw('http://localhost/?q=search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      });
      const req = new Request(raw);
      await req.parseBody();

      expect(req.input('name')).toBe('test');
    });

    it('falls back to query params', async () => {
      const raw = makeRaw('http://localhost/?page=5', { method: 'GET' });
      const req = new Request(raw);
      await req.parseBody();

      expect(req.input('page')).toBe('5');
    });

    it('returns default when key missing', async () => {
      const req = new Request(makeRaw('http://localhost/'));
      await req.parseBody();

      expect(req.input('missing', 'fallback')).toBe('fallback');
    });
  });

  describe('all() — merged data bag', () => {
    it('merges query and body', async () => {
      const raw = makeRaw('http://localhost/?source=web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      });
      const req = new Request(raw);
      await req.parseBody();

      const all = req.all();
      expect(all['source']).toBe('web');
      expect(all['name']).toBe('Alice');
    });
  });

  describe('IP detection', () => {
    it('reads from x-forwarded-for', () => {
      const raw = makeRaw('http://localhost/', {
        headers: { 'X-Forwarded-For': '1.2.3.4, 5.6.7.8' },
      });
      const req = new Request(raw);
      expect(req.ip()).toBe('1.2.3.4');
    });

    it('reads from x-real-ip as fallback', () => {
      const raw = makeRaw('http://localhost/', {
        headers: { 'X-Real-IP': '10.0.0.1' },
      });
      const req = new Request(raw);
      expect(req.ip()).toBe('10.0.0.1');
    });

    it('defaults to 127.0.0.1', () => {
      const req = new Request(makeRaw('http://localhost/'));
      expect(req.ip()).toBe('127.0.0.1');
    });
  });

  describe('content negotiation helpers', () => {
    it('wantsJson() checks Accept header', () => {
      const json = new Request(makeRaw('http://localhost/', {
        headers: { 'Accept': 'application/json' },
      }));
      expect(json.wantsJson()).toBe(true);

      const html = new Request(makeRaw('http://localhost/', {
        headers: { 'Accept': 'text/html' },
      }));
      expect(html.wantsJson()).toBe(false);
    });

    it('isJson() checks Content-Type header', () => {
      const json = new Request(makeRaw('http://localhost/', {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }));
      expect(json.isJson()).toBe(true);
    });
  });

  describe('user context', () => {
    it('returns null when no user set', () => {
      const req = new Request(makeRaw('http://localhost/'));
      expect(req.user()).toBeNull();
    });

    it('returns the user after setUser()', () => {
      const req = new Request(makeRaw('http://localhost/'));
      const user = { id: 1, name: 'Alice' };
      req.setUser(user);
      expect(req.user()).toBe(user);
    });
  });
});
