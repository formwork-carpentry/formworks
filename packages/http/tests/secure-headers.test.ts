/**
 * @module @formwork/http
 * @description Tests for SecureHeaders middleware (Sprint 19 gap fix)
 */

import { describe, it, expect } from 'vitest';
import { SecureHeadersMiddleware } from '../src/middleware/SecureHeadersMiddleware.js';
import { Request } from '../src/request/Request.js';
import { CarpenterResponse } from '../src/response/Response.js';

function makeReq(path = '/'): Request {
  return new Request(new globalThis.Request(`http://localhost${path}`));
}

function okHandler(_req: Request): Promise<CarpenterResponse> {
  return Promise.resolve(CarpenterResponse.json({ ok: true }));
}

describe('SecureHeadersMiddleware', () => {
  describe('default configuration', () => {
    const middleware = new SecureHeadersMiddleware();

    it('sets X-Frame-Options to SAMEORIGIN', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      expect(res.getHeaders()['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('sets Content-Security-Policy', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      const csp = res.getHeaders()['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'self'");
    });

    it('sets Strict-Transport-Security', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      const hsts = res.getHeaders()['strict-transport-security'];
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      expect(res.getHeaders()['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-XSS-Protection', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      expect(res.getHeaders()['x-xss-protection']).toBe('1; mode=block');
    });

    it('sets Referrer-Policy', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      expect(res.getHeaders()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('sets Permissions-Policy', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      const pp = res.getHeaders()['permissions-policy'];
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
    });

    it('sets Cross-Origin-Opener-Policy', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      expect(res.getHeaders()['cross-origin-opener-policy']).toBe('same-origin');
    });

    it('sets Cross-Origin-Resource-Policy', async () => {
      const res = await middleware.handle(makeReq(), okHandler);
      expect(res.getHeaders()['cross-origin-resource-policy']).toBe('same-origin');
    });
  });

  describe('custom configuration', () => {
    it('allows DENY for X-Frame-Options', async () => {
      const mw = new SecureHeadersMiddleware({ frameOptions: 'DENY' });
      const res = await mw.handle(makeReq(), okHandler);
      expect(res.getHeaders()['x-frame-options']).toBe('DENY');
    });

    it('disables CSP when set to false', async () => {
      const mw = new SecureHeadersMiddleware({ contentSecurityPolicy: false });
      const res = await mw.handle(makeReq(), okHandler);
      expect(res.getHeaders()['content-security-policy']).toBeUndefined();
    });

    it('disables HSTS when set to false', async () => {
      const mw = new SecureHeadersMiddleware({ hsts: false });
      const res = await mw.handle(makeReq(), okHandler);
      expect(res.getHeaders()['strict-transport-security']).toBeUndefined();
    });

    it('adds HSTS preload directive', async () => {
      const mw = new SecureHeadersMiddleware({
        hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      });
      const res = await mw.handle(makeReq(), okHandler);
      const hsts = res.getHeaders()['strict-transport-security'];
      expect(hsts).toContain('preload');
      expect(hsts).toContain('max-age=63072000');
    });

    it('supports custom CSP directives', async () => {
      const mw = new SecureHeadersMiddleware({
        contentSecurityPolicy: {
          'default-src': ["'self'"],
          'script-src': ["'self'", 'https://cdn.example.com'],
          'report-uri': ['/csp-reports'],
        },
      });
      const res = await mw.handle(makeReq(), okHandler);
      const csp = res.getHeaders()['content-security-policy'];
      expect(csp).toContain('https://cdn.example.com');
      expect(csp).toContain('report-uri /csp-reports');
    });

    it('adds custom headers', async () => {
      const mw = new SecureHeadersMiddleware({
        customHeaders: { 'X-Custom': 'val', 'X-Powered-By': 'Carpenter' },
      });
      const res = await mw.handle(makeReq(), okHandler);
      expect(res.getHeaders()['x-custom']).toBe('val');
      expect(res.getHeaders()['x-powered-by']).toBe('Carpenter');
    });

    it('supports Cross-Origin-Embedder-Policy', async () => {
      const mw = new SecureHeadersMiddleware({ crossOriginEmbedderPolicy: 'require-corp' });
      const res = await mw.handle(makeReq(), okHandler);
      expect(res.getHeaders()['cross-origin-embedder-policy']).toBe('require-corp');
    });
  });

  describe('CSP nonce generation', () => {
    it('generates unique nonce per request', async () => {
      const mw = new SecureHeadersMiddleware({ cspNonce: true });
      let n1: string | undefined, n2: string | undefined;

      await mw.handle(makeReq(), async (req) => {
        n1 = (req as Record<string, unknown>)['cspNonce'] as string;
        return CarpenterResponse.json({ ok: true });
      });
      await mw.handle(makeReq(), async (req) => {
        n2 = (req as Record<string, unknown>)['cspNonce'] as string;
        return CarpenterResponse.json({ ok: true });
      });

      expect(n1).toBeDefined();
      expect(n2).toBeDefined();
      expect(n1).not.toBe(n2);
    });

    it('includes nonce in CSP header', async () => {
      const mw = new SecureHeadersMiddleware({ cspNonce: true });
      let nonce: string | undefined;

      const res = await mw.handle(makeReq(), async (req) => {
        nonce = (req as Record<string, unknown>)['cspNonce'] as string;
        return CarpenterResponse.json({ ok: true });
      });

      const csp = res.getHeaders()['content-security-policy'];
      expect(csp).toContain(`'nonce-${nonce}'`);
    });
  });

  describe('preserves response', () => {
    it('passes through status and body', async () => {
      const mw = new SecureHeadersMiddleware();
      const res = await mw.handle(makeReq(), async () => CarpenterResponse.json({ m: 'hi' }, 201));
      expect(res.statusCode).toBe(201);
    });
  });
});
