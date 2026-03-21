/**
 * @module @formwork/http
 * @description Integration tests for HttpKernel (CARP-013), BaseController (CARP-014), ExceptionHandler (CARP-016)
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from '@formwork/core/container';
import { Router } from '../src/router/Router.js';
import { HttpKernel } from '../src/kernel/HttpKernel.js';
import { Request } from '../src/request/Request.js';
import { CarpenterResponse } from '../src/response/Response.js';
import { BaseController } from '../src/controller/BaseController.js';
import type { IRequest, IResponse, IMiddleware, NextFunction } from '@formwork/core/contracts';
import {
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  TooManyRequestsError,
} from '@formwork/core/exceptions';

// ── Fixtures ──────────────────────────────────────────────

class HomeController extends BaseController {
  index() { return this.json({ page: 'home' }); }
}

class PostController extends BaseController {
  index() { return this.json([{ id: 1, title: 'Hello' }]); }
  show(request: IRequest) {
    return this.json({ id: request.param('id'), title: `Post ${request.param('id')}` });
  }
  store(request: IRequest) {
    const body = request.body<{ title: string }>();
    return this.created({ id: 99, title: body?.title ?? 'untitled' });
  }
  destroy() { return this.noContent(); }
}

class ErrorController {
  notFound() { throw new NotFoundError('Post not found'); }
  validation() { throw new ValidationError({ title: ['Required'], body: ['Too short'] }); }
  auth() { throw new AuthenticationError(); }
  forbidden() { throw new AuthorizationError(); }
  rateLimit() { throw new TooManyRequestsError(120); }
  generic() { throw new Error('Something broke'); }
}

function req(method: string, url: string, options: RequestInit = {}): Request {
  return new Request(new globalThis.Request(url, { method, ...options }));
}

// ── CARP-013: HttpKernel ──────────────────────────────────

describe('CARP-013: HttpKernel', () => {
  let container: Container;
  let router: Router;
  let kernel: HttpKernel;

  beforeEach(() => {
    container = new Container();
    router = new Router();
    kernel = new HttpKernel(container, router, { debug: true });
  });

  describe('routing + dispatch', () => {
    it('GET route returns JSON', async () => {
      router.get('/', [HomeController, 'index']);
      const res = await kernel.handle(req('GET', 'http://localhost/'));
      expect(res.statusCode).toBe(200);
      expect(res.getBody()).toEqual({ page: 'home' });
    });

    it('route with parameters', async () => {
      router.get('/posts/:id', [PostController, 'show']);
      const res = await kernel.handle(req('GET', 'http://localhost/posts/42'));
      expect(res.statusCode).toBe(200);
      expect(res.getBody()).toEqual({ id: '42', title: 'Post 42' });
    });

    it('POST with JSON body', async () => {
      router.post('/posts', [PostController, 'store']);
      const res = await kernel.handle(req('POST', 'http://localhost/posts', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Post' }),
      }));
      expect(res.statusCode).toBe(201);
      expect(res.getBody()).toEqual({ id: 99, title: 'New Post' });
    });

    it('DELETE returns 204', async () => {
      router.delete('/posts/:id', [PostController, 'destroy']);
      const res = await kernel.handle(req('DELETE', 'http://localhost/posts/1'));
      expect(res.statusCode).toBe(204);
    });

    it('function handler', async () => {
      router.get('/health', async () => CarpenterResponse.json({ status: 'ok' }));
      const res = await kernel.handle(req('GET', 'http://localhost/health'));
      expect(res.getBody()).toEqual({ status: 'ok' });
    });

    it('handler returning plain object gets auto-wrapped as JSON', async () => {
      router.get('/auto', async () => ({ auto: true }));
      const res = await kernel.handle(req('GET', 'http://localhost/auto'));
      expect(res.statusCode).toBe(200);
      expect(res.getBody()).toEqual({ auto: true });
    });
  });

  describe('404 and 405', () => {
    it('404 for unmatched route', async () => {
      router.get('/exists', [HomeController, 'index']);
      const res = await kernel.handle(req('GET', 'http://localhost/nope'));
      expect(res.statusCode).toBe(404);
    });

    it('405 for wrong HTTP method', async () => {
      router.get('/posts', [PostController, 'index']);
      const res = await kernel.handle(req('POST', 'http://localhost/posts'));
      expect(res.statusCode).toBe(405);
    });
  });

  describe('exception handling', () => {
    beforeEach(() => {
      router.get('/err/404', [ErrorController, 'notFound']);
      router.get('/err/422', [ErrorController, 'validation']);
      router.get('/err/401', [ErrorController, 'auth']);
      router.get('/err/403', [ErrorController, 'forbidden']);
      router.get('/err/429', [ErrorController, 'rateLimit']);
      router.get('/err/500', [ErrorController, 'generic']);
    });

    it('NotFoundError → 404', async () => {
      const res = await kernel.handle(req('GET', 'http://localhost/err/404'));
      expect(res.statusCode).toBe(404);
      expect((res.getBody() as Record<string, unknown>).message).toBe('Post not found');
    });

    it('ValidationError → 422 with errors', async () => {
      const res = await kernel.handle(req('GET', 'http://localhost/err/422'));
      expect(res.statusCode).toBe(422);
      const body = res.getBody() as { errors: Record<string, string[]> };
      expect(body.errors.title).toEqual(['Required']);
    });

    it('AuthenticationError → 401', async () => {
      const res = await kernel.handle(req('GET', 'http://localhost/err/401'));
      expect(res.statusCode).toBe(401);
    });

    it('AuthorizationError → 403', async () => {
      const res = await kernel.handle(req('GET', 'http://localhost/err/403'));
      expect(res.statusCode).toBe(403);
    });

    it('TooManyRequestsError → 429 + Retry-After', async () => {
      const res = await kernel.handle(req('GET', 'http://localhost/err/429'));
      expect(res.statusCode).toBe(429);
      expect(res.getHeaders()['retry-after']).toBe('120');
    });

    it('generic Error → 500 with debug info', async () => {
      const res = await kernel.handle(req('GET', 'http://localhost/err/500'));
      expect(res.statusCode).toBe(500);
      const body = res.getBody() as { message: string; stack: string };
      expect(body.message).toBe('Something broke');
      expect(body.stack).toBeDefined();
    });

    it('hides details in production mode', async () => {
      const prodKernel = new HttpKernel(container, router, { debug: false });
      const res = await prodKernel.handle(req('GET', 'http://localhost/err/500'));
      const body = res.getBody() as Record<string, unknown>;
      expect(body.message).toBe('Internal Server Error');
      expect(body.stack).toBeUndefined();
    });
  });

  describe('middleware', () => {
    it('global middleware runs on every request', async () => {
      const log: string[] = [];
      const mw: IMiddleware = {
        async handle(_r: IRequest, next: NextFunction) {
          log.push('before');
          const res = await next();
          log.push('after');
          return res;
        },
      };
      kernel = new HttpKernel(container, router, { middleware: [mw] });
      router.get('/', [HomeController, 'index']);
      await kernel.handle(req('GET', 'http://localhost/'));
      expect(log).toEqual(['before', 'after']);
    });

    it('route middleware from IoC container', async () => {
      const log: string[] = [];
      class AuthMw implements IMiddleware {
        async handle(_r: IRequest, next: NextFunction) { log.push('auth'); return next(); }
      }
      container.bind('auth', () => new AuthMw());
      router.group({ middleware: ['auth'] }, () => {
        router.get('/secret', [HomeController, 'index']);
      });
      kernel = new HttpKernel(container, router);
      await kernel.handle(req('GET', 'http://localhost/secret'));
      expect(log).toEqual(['auth']);
    });

    it('middleware short-circuits', async () => {
      const guard: IMiddleware = {
        async handle() { return CarpenterResponse.json({ error: 'blocked' }, 401); },
      };
      kernel = new HttpKernel(container, router, { middleware: [guard] });
      router.get('/', [HomeController, 'index']);
      const res = await kernel.handle(req('GET', 'http://localhost/'));
      expect(res.statusCode).toBe(401);
    });

    it('global + route middleware execute in order', async () => {
      const order: string[] = [];
      const globalMw: IMiddleware = {
        async handle(_r: IRequest, next: NextFunction) { order.push('global'); return next(); },
      };
      class RouteMw implements IMiddleware {
        async handle(_r: IRequest, next: NextFunction) { order.push('route'); return next(); }
      }
      container.bind('route-mw', () => new RouteMw());
      kernel = new HttpKernel(container, router, { middleware: [globalMw] });
      router.group({ middleware: ['route-mw'] }, () => {
        router.get('/test', [HomeController, 'index']);
      });
      await kernel.handle(req('GET', 'http://localhost/test'));
      expect(order).toEqual(['global', 'route']);
    });
  });

  describe('custom exception renderer', () => {
    it('takes priority over built-in', async () => {
      kernel.onError((err) => {
        if (err.message === 'teapot') return CarpenterResponse.json({ tea: true }, 418);
        return null;
      });
      router.get('/tea', async () => { throw new Error('teapot'); });
      const res = await kernel.handle(req('GET', 'http://localhost/tea'));
      expect(res.statusCode).toBe(418);
    });
  });
});

// ── CARP-014: BaseController ──────────────────────────────

describe('CARP-014: BaseController', () => {
  class TC extends BaseController {
    doJson() { return this.json({ ok: true }); }
    doCreated() { return this.created({ id: 1 }); }
    doRedirect() { return this.redirect('/login'); }
    doNotFound() { return this.notFound('Nope'); }
    doNoContent() { return this.noContent(); }
    doView() { return this.view('Dashboard', { user: 'Alice' }); }
  }

  const ctrl = new TC();

  it('json()', () => {
    const r = ctrl.doJson();
    expect(r.statusCode).toBe(200);
    expect(r.getBody()).toEqual({ ok: true });
  });

  it('created()', () => {
    expect(ctrl.doCreated().statusCode).toBe(201);
  });

  it('redirect()', () => {
    const r = ctrl.doRedirect();
    expect(r.statusCode).toBe(302);
    expect(r.getHeaders()['location']).toBe('/login');
  });

  it('notFound()', () => {
    expect(ctrl.doNotFound().statusCode).toBe(404);
  });

  it('noContent()', () => {
    expect(ctrl.doNoContent().statusCode).toBe(204);
  });

  it('view()', () => {
    const r = ctrl.doView();
    expect(r.page).toBe('Dashboard');
    expect(r.props).toEqual({ user: 'Alice' });
  });
});
