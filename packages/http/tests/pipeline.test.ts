/**
 * @module @formwork/http
 * @description Tests for Middleware Pipeline (CARP-011)
 */

import { describe, it, expect } from 'vitest';
import { Pipeline } from '../src/middleware/Pipeline.js';
import { Request } from '../src/request/Request.js';
import { CarpenterResponse } from '../src/response/Response.js';
import type { IMiddleware, IRequest, IResponse, NextFunction } from '@formwork/core/contracts';

/** Helper to create a test request */
function makeReq(url = 'http://localhost/test'): Request {
  return new Request(new globalThis.Request(url));
}

describe('CARP-011: Middleware Pipeline', () => {
  describe('basic execution', () => {
    it('executes the destination when no middleware', async () => {
      const request = makeReq();
      const res = await Pipeline.create()
        .send(request)
        .through([])
        .then(async () => CarpenterResponse.json({ ok: true }));

      expect(res.getBody()).toEqual({ ok: true });
    });

    it('passes request through a single function middleware', async () => {
      const log: string[] = [];

      const middleware = async (req: IRequest, next: NextFunction) => {
        log.push('before');
        const res = await next();
        log.push('after');
        return res;
      };

      await Pipeline.create()
        .send(makeReq())
        .through([middleware])
        .then(async () => {
          log.push('handler');
          return CarpenterResponse.json({ ok: true });
        });

      expect(log).toEqual(['before', 'handler', 'after']);
    });
  });

  describe('middleware ordering', () => {
    it('executes middleware in registration order', async () => {
      const order: number[] = [];

      const m1 = async (_req: IRequest, next: NextFunction) => {
        order.push(1);
        return next();
      };
      const m2 = async (_req: IRequest, next: NextFunction) => {
        order.push(2);
        return next();
      };
      const m3 = async (_req: IRequest, next: NextFunction) => {
        order.push(3);
        return next();
      };

      await Pipeline.create()
        .send(makeReq())
        .through([m1, m2, m3])
        .then(async () => {
          order.push(0); // handler
          return new CarpenterResponse('ok');
        });

      expect(order).toEqual([1, 2, 3, 0]);
    });
  });

  describe('short-circuit', () => {
    it('middleware can return response without calling next()', async () => {
      const log: string[] = [];

      const authMiddleware = async (_req: IRequest, _next: NextFunction) => {
        log.push('auth-reject');
        return CarpenterResponse.json({ error: 'Unauthorized' }, 401);
      };

      const neverReached = async (_req: IRequest, next: NextFunction) => {
        log.push('should-not-run');
        return next();
      };

      const res = await Pipeline.create()
        .send(makeReq())
        .through([authMiddleware, neverReached])
        .then(async () => {
          log.push('handler-should-not-run');
          return new CarpenterResponse('ok');
        });

      expect(res.statusCode).toBe(401);
      expect(log).toEqual(['auth-reject']);
    });
  });

  describe('class-based middleware', () => {
    it('resolves class middleware via handle()', async () => {
      const log: string[] = [];

      class CorsMiddleware implements IMiddleware {
        async handle(request: IRequest, next: NextFunction): Promise<IResponse> {
          log.push('cors');
          const response = await next();
          response.header('access-control-allow-origin', '*');
          return response;
        }
      }

      const res = await Pipeline.create()
        .send(makeReq())
        .through([new CorsMiddleware()])
        .then(async () => CarpenterResponse.json({ ok: true }));

      expect(log).toEqual(['cors']);
      // The response object from then() is what CorsMiddleware modifies
      // Since CarpenterResponse.json returns a new instance, we check the final one
      expect(res.getHeaders()['access-control-allow-origin']).toBe('*');
    });
  });

  describe('mixed middleware types', () => {
    it('handles both class and function middleware in same pipeline', async () => {
      const log: string[] = [];

      class ClassMw implements IMiddleware {
        async handle(_req: IRequest, next: NextFunction): Promise<IResponse> {
          log.push('class');
          return next();
        }
      }

      const fnMw = async (_req: IRequest, next: NextFunction) => {
        log.push('function');
        return next();
      };

      await Pipeline.create()
        .send(makeReq())
        .through([new ClassMw(), fnMw])
        .then(async () => {
          log.push('handler');
          return new CarpenterResponse('ok');
        });

      expect(log).toEqual(['class', 'function', 'handler']);
    });
  });

  describe('pipe() — append middleware', () => {
    it('adds middleware to the end of the chain', async () => {
      const order: number[] = [];

      const res = await Pipeline.create()
        .send(makeReq())
        .through([async (_r: IRequest, n: NextFunction) => { order.push(1); return n(); }])
        .pipe(async (_r: IRequest, n: NextFunction) => { order.push(2); return n(); })
        .then(async () => {
          order.push(3);
          return new CarpenterResponse('ok');
        });

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('response modification', () => {
    it('middleware can modify the response after next()', async () => {
      const addHeader = async (_req: IRequest, next: NextFunction) => {
        const res = await next();
        res.header('x-powered-by', 'Carpenter');
        return res;
      };

      const res = await Pipeline.create()
        .send(makeReq())
        .through([addHeader])
        .then(async () => CarpenterResponse.json({ ok: true }));

      expect(res.getHeaders()['x-powered-by']).toBe('Carpenter');
    });
  });
});
