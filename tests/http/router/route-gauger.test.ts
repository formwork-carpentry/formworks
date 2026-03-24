import { describe, expect, it } from 'vitest';

import {
  buildRouteGauger,
  defineRouteGaugerReference,
  generateRouteGaugerFiles,
} from '../../../src/http/router/route-gauger.js';

describe('route-gauger', () => {
  it('builds href and query params from route parameters', () => {
    const route = defineRouteGaugerReference(
      'posts.show',
      'GET',
      '/posts/:id/:slug?',
      { id: 12, q: 'draft' },
    );

    expect(route.href).toBe('/posts/12?q=draft');
    expect(route.url).toBe('/posts/12?q=draft');
  });

  it('throws when required route param is missing', () => {
    expect(() =>
      defineRouteGaugerReference('posts.show', 'GET', '/posts/:id'),
    ).toThrow('Missing required route parameter "id" for posts.show.');
  });

  it('builds a sorted route manifest and generated files', () => {
    const routes = [
      { name: 'posts.show', method: 'GET', path: '/posts/:id' },
      { name: 'posts.index', method: 'GET', path: '/posts' },
      { name: 'health.check', method: 'GET', path: '/health' },
    ];

    const manifest = buildRouteGauger(routes as never);
    expect(manifest.map((entry) => entry.routeName)).toEqual([
      'health.check',
      'posts.index',
      'posts.show',
    ]);

    const files = generateRouteGaugerFiles(routes as never);
    expect(files.some((f) => f.fileName === 'posts.ts')).toBe(true);
    expect(files.some((f) => f.fileName === 'health.ts')).toBe(true);
    expect(files.some((f) => f.fileName === 'index.ts')).toBe(true);
  });
});
