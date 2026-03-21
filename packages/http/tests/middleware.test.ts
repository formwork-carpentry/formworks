import { describe, it, expect, beforeEach } from 'vitest';
import { CorsMiddleware } from '../src/middleware/CorsMiddleware.js';
import { RateLimitMiddleware } from '../src/middleware/RateLimitMiddleware.js';
import { Request } from '../src/request/Request.js';
import { CarpenterResponse } from '../src/response/Response.js';

function makeRequest(method: string, headers: Record<string, string> = {}): Request {
  return new Request(new globalThis.Request('http://localhost/test', { method, headers }));
}

function h(res: CarpenterResponse, name: string): string | undefined {
  return res.getHeaders()[name.toLowerCase()] ?? res.getHeaders()[name];
}

describe('@formwork/http: CorsMiddleware', () => {
  it('adds CORS headers to normal responses', () => {
    const cors = new CorsMiddleware({ origin: '*' });
    const res = cors.handle(
      makeRequest('GET', { origin: 'http://app.com' }),
      () => CarpenterResponse.json({ ok: true }),
    ) as CarpenterResponse;
    expect(h(res, 'Access-Control-Allow-Origin')).toBe('*');
    expect(h(res, 'Access-Control-Allow-Methods')).toContain('GET');
  });

  it('returns 204 for OPTIONS preflight', () => {
    const cors = new CorsMiddleware();
    const res = cors.handle(
      makeRequest('OPTIONS', { origin: 'http://app.com' }),
      () => CarpenterResponse.json({}),
    ) as CarpenterResponse;
    expect(res.statusCode).toBe(204);
    expect(h(res, 'Access-Control-Max-Age')).toBe('86400');
  });

  it('specific origin', () => {
    const cors = new CorsMiddleware({ origin: 'https://myapp.com' });
    const res = cors.handle(
      makeRequest('GET', { origin: 'https://myapp.com' }),
      () => CarpenterResponse.json({}),
    ) as CarpenterResponse;
    expect(h(res, 'Access-Control-Allow-Origin')).toBe('https://myapp.com');
  });

  it('array of origins — matching', () => {
    const cors = new CorsMiddleware({ origin: ['https://a.com', 'https://b.com'] });
    const res = cors.handle(
      makeRequest('GET', { origin: 'https://b.com' }),
      () => CarpenterResponse.json({}),
    ) as CarpenterResponse;
    expect(h(res, 'Access-Control-Allow-Origin')).toBe('https://b.com');
  });

  it('credentials header when enabled', () => {
    const cors = new CorsMiddleware({ credentials: true });
    const res = cors.handle(makeRequest('GET'), () => CarpenterResponse.json({})) as CarpenterResponse;
    expect(h(res, 'Access-Control-Allow-Credentials')).toBe('true');
  });

  it('exposed headers', () => {
    const cors = new CorsMiddleware({ exposedHeaders: ['X-Total-Count'] });
    const res = cors.handle(makeRequest('GET'), () => CarpenterResponse.json({})) as CarpenterResponse;
    expect(h(res, 'Access-Control-Expose-Headers')).toContain('X-Total-Count');
  });
});

describe('@formwork/http: RateLimitMiddleware', () => {
  let limiter: RateLimitMiddleware;
  beforeEach(() => { limiter = new RateLimitMiddleware({ maxRequests: 3, windowSeconds: 60 }); });

  it('allows requests under limit', () => {
    const req = makeRequest('GET', { 'x-forwarded-for': '1.2.3.4' });
    const res = limiter.handle(req, () => CarpenterResponse.json({ ok: true })) as CarpenterResponse;
    expect(res.statusCode).toBe(200);
    expect(h(res, 'X-RateLimit-Limit')).toBe('3');
    expect(h(res, 'X-RateLimit-Remaining')).toBe('2');
  });

  it('returns 429 when limit exceeded', () => {
    const req = makeRequest('GET', { 'x-forwarded-for': '1.2.3.4' });
    const ok = () => CarpenterResponse.json({ ok: true });
    limiter.handle(req, ok); limiter.handle(req, ok); limiter.handle(req, ok);
    const res = limiter.handle(req, ok) as CarpenterResponse;
    expect(res.statusCode).toBe(429);
    expect(h(res, 'Retry-After')).toBeDefined();
  });

  it('different IPs have separate limits', () => {
    const ok = () => CarpenterResponse.json({ ok: true });
    for (let i = 0; i < 3; i++) limiter.handle(makeRequest('GET', { 'x-forwarded-for': '1.1.1.1' }), ok);
    const res = limiter.handle(makeRequest('GET', { 'x-forwarded-for': '2.2.2.2' }), ok) as CarpenterResponse;
    expect(res.statusCode).toBe(200);
  });

  it('remaining()', () => {
    const ok = () => CarpenterResponse.json({ ok: true });
    expect(limiter.remaining('1.2.3.4')).toBe(3);
    limiter.handle(makeRequest('GET', { 'x-forwarded-for': '1.2.3.4' }), ok);
    expect(limiter.remaining('1.2.3.4')).toBe(2);
  });

  it('reset() clears all', () => {
    const ok = () => CarpenterResponse.json({ ok: true });
    limiter.handle(makeRequest('GET', { 'x-forwarded-for': '1.2.3.4' }), ok);
    limiter.reset();
    expect(limiter.remaining('1.2.3.4')).toBe(3);
  });

  it('resetKey() clears specific key', () => {
    const ok = () => CarpenterResponse.json({ ok: true });
    limiter.handle(makeRequest('GET', { 'x-forwarded-for': '1.1.1.1' }), ok);
    limiter.handle(makeRequest('GET', { 'x-forwarded-for': '2.2.2.2' }), ok);
    limiter.resetKey('1.1.1.1');
    expect(limiter.remaining('1.1.1.1')).toBe(3);
    expect(limiter.remaining('2.2.2.2')).toBe(2);
  });

  it('custom key resolver', () => {
    const apiLimiter = new RateLimitMiddleware({
      maxRequests: 2, windowSeconds: 60,
      keyResolver: (req) => req.header('x-api-key') ?? 'anonymous',
    });
    const ok = () => CarpenterResponse.json({ ok: true });
    apiLimiter.handle(makeRequest('GET', { 'x-api-key': 'key-123' }), ok);
    apiLimiter.handle(makeRequest('GET', { 'x-api-key': 'key-123' }), ok);
    const res = apiLimiter.handle(makeRequest('GET', { 'x-api-key': 'key-123' }), ok) as CarpenterResponse;
    expect(res.statusCode).toBe(429);
  });
});
