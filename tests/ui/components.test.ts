import { describe, expect, it } from 'vitest';

import {
  ComponentRegistry,
  MockRenderer,
  ReactPageRenderer,
  SolidPageRenderer,
  VuePageRenderer,
  SveltePageRenderer,
  createForm,
  createLink,
} from '../../src/ui/components.js';
import type { ResolvedPage } from '../../src/ui/types.js';

const page: ResolvedPage = {
  component: 'Home',
  props: { title: '<Title>' },
  url: '/',
  version: '1',
};

describe('ui/components', () => {
  it('registers and resolves pages and layouts', () => {
    const registry = new ComponentRegistry()
      .page('home', './pages/Home.tsx')
      .layout('main', './layouts/Main.tsx')
      .autoRegister('./pages', { users: 'Users.tsx' });

    expect(registry.has('home')).toBe(true);
    expect(registry.resolve('home')).toBe('./pages/Home.tsx');
    expect(registry.resolve('users')).toBe('./pages/Users.tsx');
    expect(registry.resolveLayout('main')).toBe('./layouts/Main.tsx');
    expect(registry.resolve('missing')).toBeNull();
    expect(registry.all().size).toBe(2);
    expect(registry.allLayouts().size).toBe(1);
  });

  it('builds link and form objects with defaults', () => {
    const link = createLink('/users', { preserveState: true });
    const form = createForm('/users', 'POST', { name: 'A' });

    expect(link).toEqual({ href: '/users', method: 'GET', preserveState: true });
    expect(form).toEqual({
      action: '/users',
      method: 'POST',
      fields: { name: 'A' },
      errors: {},
      processing: false,
    });
  });

  it('records rendered pages and exposes assertion helpers', async () => {
    const renderer = new MockRenderer();

    await renderer.render(page);

    expect(renderer.getRendered()).toHaveLength(1);
    expect(() => renderer.assertRendered('Home')).not.toThrow();
    expect(() => renderer.assertRenderedWithProps('Home', { title: '<Title>' })).not.toThrow();
    expect(() => renderer.assertCount(1)).not.toThrow();

    renderer.reset();
    expect(renderer.getRendered()).toEqual([]);
    expect(() => renderer.assertRendered('Home')).toThrow();
  });

  it('adapters render known components and fail for unknown components', async () => {
    const config = {
      resolve: (name: string) => (name === 'Home' ? { component: 'ok' } : null),
      el: 'app-root',
    };

    const react = new ReactPageRenderer(config);
    const vue = new VuePageRenderer(config);
    const svelte = new SveltePageRenderer(config);
    const solid = new SolidPageRenderer(config);

    await expect(react.render(page)).resolves.toContain('id="app-root"');
    await expect(vue.render(page)).resolves.toContain('id="app-root"');
    await expect(svelte.render(page)).resolves.toContain('id="app-root"');
    await expect(solid.render(page)).resolves.toContain('id="app-root"');

    await expect(react.render({ ...page, component: 'Missing' })).rejects.toThrow('not found');
    await expect(vue.render({ ...page, component: 'Missing' })).rejects.toThrow('not found');
    await expect(svelte.render({ ...page, component: 'Missing' })).rejects.toThrow('not found');
    await expect(solid.render({ ...page, component: 'Missing' })).rejects.toThrow('not found');
  });
});
