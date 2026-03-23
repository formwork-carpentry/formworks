/**
 * @module @carpentry/http
 * @description Tests for HTTP Response builder (CARP-010)
 */

import { describe, it, expect } from 'vitest';
import { CarpenterResponse, ViewResponse, response } from '../src/response/Response.js';

describe('CARP-010: HTTP Response Object', () => {
  describe('basic construction', () => {
    it('creates a 200 response by default', () => {
      const res = new CarpenterResponse('Hello');
      expect(res.statusCode).toBe(200);
      expect(res.getBody()).toBe('Hello');
    });

    it('accepts custom status code', () => {
      const res = new CarpenterResponse('Created', 201);
      expect(res.statusCode).toBe(201);
    });
  });

  describe('fluent builder (Builder pattern)', () => {
    it('header() sets header and returns this', () => {
      const res = new CarpenterResponse('ok');
      const returned = res.header('x-custom', 'value');
      expect(returned).toBe(res); // fluent
      expect(res.getHeaders()['x-custom']).toBe('value');
    });

    it('status() sets status and returns this', () => {
      const res = new CarpenterResponse('ok');
      const returned = res.status(404);
      expect(returned).toBe(res);
      expect(res.statusCode).toBe(404);
    });

    it('chains multiple calls', () => {
      const res = new CarpenterResponse('ok')
        .status(201)
        .header('x-a', '1')
        .header('x-b', '2')
        .cookie('session', 'abc123', { httpOnly: true });

      expect(res.statusCode).toBe(201);
      expect(res.getHeaders()['x-a']).toBe('1');
      expect(res.getHeaders()['x-b']).toBe('2');
    });
  });

  describe('toNative() — Web Standard Response', () => {
    it('produces a valid Response for string body', () => {
      const res = new CarpenterResponse('<h1>Hi</h1>').status(200);
      const native = res.toNative();

      expect(native).toBeInstanceOf(Response);
      expect(native.status).toBe(200);
      expect(native.headers.get('content-type')).toBe('text/html; charset=utf-8');
    });

    it('produces JSON response for object body', () => {
      const res = new CarpenterResponse({ name: 'Alice' });
      const native = res.toNative();

      expect(native.headers.get('content-type')).toBe('application/json; charset=utf-8');
    });

    it('produces null body for null content', () => {
      const res = new CarpenterResponse(null, 204);
      const native = res.toNative();

      expect(native.status).toBe(204);
    });

    it('includes custom headers', () => {
      const res = new CarpenterResponse('ok').header('x-request-id', 'abc');
      const native = res.toNative();

      expect(native.headers.get('x-request-id')).toBe('abc');
    });

    it('serializes cookies into Set-Cookie headers', () => {
      const res = new CarpenterResponse('ok')
        .cookie('token', 'xyz', { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 3600, path: '/' });
      const native = res.toNative();

      const setCookie = native.headers.get('set-cookie')!;
      expect(setCookie).toContain('token=xyz');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('SameSite=strict');
      expect(setCookie).toContain('Max-Age=3600');
      expect(setCookie).toContain('Path=/');
    });
  });

  describe('static factories', () => {
    it('json() creates a JSON response', () => {
      const res = CarpenterResponse.json({ ok: true }, 201);
      expect(res.statusCode).toBe(201);
      expect(res.getBody()).toEqual({ ok: true });
      expect(res.getHeaders()['content-type']).toBe('application/json; charset=utf-8');
    });

    it('redirect() creates a redirect response', () => {
      const res = CarpenterResponse.redirect('/dashboard');
      expect(res.statusCode).toBe(302);
      expect(res.getHeaders()['location']).toBe('/dashboard');
    });

    it('redirect() with custom status', () => {
      const res = CarpenterResponse.redirect('/new-url', 301);
      expect(res.statusCode).toBe(301);
    });

    it('notFound() creates a 404 JSON response', () => {
      const res = CarpenterResponse.notFound('Page not found');
      expect(res.statusCode).toBe(404);
      expect(res.getBody()).toEqual({ error: 'Page not found' });
    });

    it('noContent() creates a 204 response', () => {
      const res = CarpenterResponse.noContent();
      expect(res.statusCode).toBe(204);
    });

    it('view() creates a ViewResponse with page and props', () => {
      const res = CarpenterResponse.view('Pages/Dashboard', { user: 'Alice' });
      expect(res).toBeInstanceOf(ViewResponse);
      expect(res.page).toBe('Pages/Dashboard');
      expect(res.props).toEqual({ user: 'Alice' });
    });
  });

  describe('response() helper', () => {
    it('creates a basic response', () => {
      const res = response('Hello', 200);
      expect(res).toBeInstanceOf(CarpenterResponse);
      expect(res.getBody()).toBe('Hello');
    });
  });
});
