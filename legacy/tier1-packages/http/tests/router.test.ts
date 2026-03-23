/**
 * @module @carpentry/http
 * @description Tests for Router (CARP-012)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Router } from '../src/router/Router.js';
import { CarpenterResponse } from '../src/response/Response.js';

// Mock controller class
class PostController {
  index() { return CarpenterResponse.json([]); }
  create() { return CarpenterResponse.json({}); }
  store() { return CarpenterResponse.json({}, 201); }
  show() { return CarpenterResponse.json({}); }
  edit() { return CarpenterResponse.json({}); }
  update() { return CarpenterResponse.json({}); }
  destroy() { return CarpenterResponse.noContent(); }
}

class UserController {
  index() { return CarpenterResponse.json([]); }
}

describe('CARP-012: Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  describe('route registration', () => {
    it('registers GET routes', () => {
      router.get('/users', [UserController, 'index']);
      const match = router.resolve('GET', '/users');
      expect(match).not.toBeNull();
      expect(match!.route.method).toBe('GET');
      expect(match!.route.path).toBe('/users');
    });

    it('registers POST routes', () => {
      router.post('/users', [UserController, 'index']);
      const match = router.resolve('POST', '/users');
      expect(match).not.toBeNull();
    });

    it('registers PUT, PATCH, DELETE routes', () => {
      router.put('/users/:id', [UserController, 'index']);
      router.patch('/users/:id', [UserController, 'index']);
      router.delete('/users/:id', [UserController, 'index']);

      expect(router.resolve('PUT', '/users/1')).not.toBeNull();
      expect(router.resolve('PATCH', '/users/1')).not.toBeNull();
      expect(router.resolve('DELETE', '/users/1')).not.toBeNull();
    });

    it('returns null for unmatched routes', () => {
      router.get('/users', [UserController, 'index']);
      expect(router.resolve('GET', '/posts')).toBeNull();
    });

    it('returns null for wrong HTTP method', () => {
      router.get('/users', [UserController, 'index']);
      expect(router.resolve('POST', '/users')).toBeNull();
    });
  });

  describe('route parameters', () => {
    it('extracts named parameters', () => {
      router.get('/users/:id', [UserController, 'index']);
      const match = router.resolve('GET', '/users/42');

      expect(match).not.toBeNull();
      expect(match!.params['id']).toBe('42');
    });

    it('extracts multiple parameters', () => {
      router.get('/posts/:postId/comments/:commentId', [UserController, 'index']);
      const match = router.resolve('GET', '/posts/10/comments/25');

      expect(match!.params['postId']).toBe('10');
      expect(match!.params['commentId']).toBe('25');
    });

    it('matches parameters with various characters', () => {
      router.get('/users/:slug', [UserController, 'index']);
      const match = router.resolve('GET', '/users/john-doe');

      expect(match!.params['slug']).toBe('john-doe');
    });
  });

  describe('route constraints', () => {
    it('where() constrains parameter format', () => {
      router.get('/users/:id', [UserController, 'index']).where('id', /[0-9]+/);

      expect(router.resolve('GET', '/users/42')).not.toBeNull();
      expect(router.resolve('GET', '/users/abc')).toBeNull();
    });
  });

  describe('named routes', () => {
    it('names a route', () => {
      router.get('/dashboard', [UserController, 'index']).name('dashboard');
      const url = router.route('dashboard');
      expect(url).toBe('/dashboard');
    });

    it('generates URL with parameters', () => {
      router.get('/posts/:id', [PostController, 'show']).name('posts.show');
      const url = router.route('posts.show', { id: 42 });
      expect(url).toBe('/posts/42');
    });

    it('generates URL with multiple parameters', () => {
      router.get('/posts/:postId/comments/:commentId', [PostController, 'show'])
        .name('comments.show');
      const url = router.route('comments.show', { postId: 10, commentId: 25 });
      expect(url).toBe('/posts/10/comments/25');
    });

    it('throws on duplicate route names', () => {
      router.get('/a', [UserController, 'index']).name('route-a');
      expect(() => {
        router.get('/b', [UserController, 'index']).name('route-a');
      }).toThrow('Duplicate route name');
    });

    it('throws on unknown route name', () => {
      expect(() => router.route('nonexistent')).toThrow('not found');
    });
  });

  describe('resource()', () => {
    it('registers all 7 RESTful routes', () => {
      router.resource('posts', PostController);

      const routes = router.getRoutes();
      const postRoutes = routes.filter((r) => r.path.startsWith('/posts'));

      expect(postRoutes.length).toBe(7);

      // Verify each resource route exists
      expect(router.resolve('GET', '/posts')).not.toBeNull();       // index
      expect(router.resolve('GET', '/posts/create')).not.toBeNull();// create
      expect(router.resolve('POST', '/posts')).not.toBeNull();      // store
      expect(router.resolve('GET', '/posts/1')).not.toBeNull();     // show
      expect(router.resolve('GET', '/posts/1/edit')).not.toBeNull();// edit
      expect(router.resolve('PUT', '/posts/1')).not.toBeNull();     // update
      expect(router.resolve('DELETE', '/posts/1')).not.toBeNull();  // destroy
    });

    it('generates correct named routes for resources', () => {
      router.resource('posts', PostController);

      expect(router.route('posts.index')).toBe('/posts');
      expect(router.route('posts.create')).toBe('/posts/create');
      expect(router.route('posts.show', { id: 5 })).toBe('/posts/5');
      expect(router.route('posts.edit', { id: 5 })).toBe('/posts/5/edit');
    });
  });

  describe('apiResource()', () => {
    it('registers 5 API routes (no create/edit)', () => {
      router.apiResource('posts', PostController);

      const routes = router.getRoutes();
      const postRoutes = routes.filter((r) => r.path.startsWith('/posts'));

      expect(postRoutes.length).toBe(5);

      expect(router.resolve('GET', '/posts')).not.toBeNull();
      expect(router.resolve('POST', '/posts')).not.toBeNull();
      expect(router.resolve('GET', '/posts/1')).not.toBeNull();
      expect(router.resolve('PUT', '/posts/1')).not.toBeNull();
      expect(router.resolve('DELETE', '/posts/1')).not.toBeNull();

      // Note: /posts/create matches /posts/:id with id="create"
      // This is correct — use route constraints to prevent if needed
      const createMatch = router.resolve('GET', '/posts/create');
      expect(createMatch).not.toBeNull();
      expect(createMatch!.params['id']).toBe('create');
    });
  });

  describe('route groups', () => {
    it('applies prefix to grouped routes', () => {
      router.group({ prefix: '/api/v1' }, () => {
        router.get('/users', [UserController, 'index']);
        router.get('/posts', [PostController, 'index']);
      });

      expect(router.resolve('GET', '/api/v1/users')).not.toBeNull();
      expect(router.resolve('GET', '/api/v1/posts')).not.toBeNull();
      expect(router.resolve('GET', '/users')).toBeNull(); // not at root
    });

    it('applies middleware to grouped routes', () => {
      router.group({ middleware: ['auth', 'verified'] }, () => {
        router.get('/dashboard', [UserController, 'index']);
      });

      const match = router.resolve('GET', '/dashboard');
      expect(match!.route.middleware).toEqual(['auth', 'verified']);
    });

    it('nests groups with accumulated prefix', () => {
      router.group({ prefix: '/api' }, () => {
        router.group({ prefix: '/v1' }, () => {
          router.get('/users', [UserController, 'index']);
        });
      });

      expect(router.resolve('GET', '/api/v1/users')).not.toBeNull();
    });

    it('nests groups with accumulated middleware', () => {
      router.group({ middleware: ['cors'] }, () => {
        router.group({ middleware: ['auth'] }, () => {
          router.get('/secret', [UserController, 'index']);
        });
      });

      const match = router.resolve('GET', '/secret');
      expect(match!.route.middleware).toEqual(['cors', 'auth']);
    });

    it('does not leak group config to routes outside the group', () => {
      router.group({ prefix: '/admin', middleware: ['admin'] }, () => {
        router.get('/dashboard', [UserController, 'index']);
      });

      router.get('/public', [UserController, 'index']);

      const admin = router.resolve('GET', '/admin/dashboard');
      expect(admin!.route.middleware).toEqual(['admin']);

      const pub = router.resolve('GET', '/public');
      expect(pub!.route.middleware).toEqual([]);
    });
  });

  describe('per-route middleware', () => {
    it('route-level middleware adds to group middleware', () => {
      router.group({ middleware: ['cors'] }, () => {
        router.get('/data', [UserController, 'index']).middleware('throttle');
      });

      const match = router.resolve('GET', '/data');
      expect(match!.route.middleware).toEqual(['cors', 'throttle']);
    });
  });

  describe('path normalization', () => {
    it('normalizes leading slash', () => {
      router.get('users', [UserController, 'index']);
      expect(router.resolve('GET', '/users')).not.toBeNull();
    });

    it('strips trailing slash', () => {
      router.get('/users/', [UserController, 'index']);
      expect(router.resolve('GET', '/users')).not.toBeNull();
    });
  });

  describe('getRoutes()', () => {
    it('returns all registered routes', () => {
      router.get('/a', [UserController, 'index']);
      router.post('/b', [UserController, 'index']);
      router.delete('/c', [UserController, 'index']);

      const routes = router.getRoutes();
      expect(routes).toHaveLength(3);
      expect(routes.map((r) => r.method)).toEqual(['GET', 'POST', 'DELETE']);
    });
  });

  describe('route model binding', () => {
    it('registers and resolves bindings', async () => {
      const router = new Router();
      router.bind('post', (value) => ({ id: Number(value), title: `Post ${value}` }));

      const resolved = await router.resolveBindings({ post: '42', page: '1' });
      expect(resolved['post']).toEqual({ id: 42, title: 'Post 42' });
      expect(resolved['page']).toBe('1'); // unbound params passed through
    });

    it('supports async resolvers', async () => {
      const router = new Router();
      router.bind('user', async (value) => {
        return { id: Number(value), name: `User ${value}` };
      });

      const resolved = await router.resolveBindings({ user: '7' });
      expect(resolved['user']).toEqual({ id: 7, name: 'User 7' });
    });

    it('hasBinding checks registration', () => {
      const router = new Router();
      router.bind('post', (v) => v);
      expect(router.hasBinding('post')).toBe(true);
      expect(router.hasBinding('comment')).toBe(false);
    });

    it('resolves multiple bindings', async () => {
      const router = new Router();
      router.bind('post', (v) => ({ type: 'post', id: v }));
      router.bind('comment', (v) => ({ type: 'comment', id: v }));

      const resolved = await router.resolveBindings({ post: '1', comment: '5' });
      expect(resolved['post']).toEqual({ type: 'post', id: '1' });
      expect(resolved['comment']).toEqual({ type: 'comment', id: '5' });
    });

    it('handles empty params', async () => {
      const router = new Router();
      const resolved = await router.resolveBindings({});
      expect(resolved).toEqual({});
    });
  });
});
