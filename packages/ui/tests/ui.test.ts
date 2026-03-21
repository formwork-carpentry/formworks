import { describe, it, expect, beforeEach } from 'vitest';
import {
  UIManager, ComponentRegistry, MockRenderer,
  createLink, createForm,
  ReactPageRenderer, VuePageRenderer, SveltePageRenderer, SolidPageRenderer,
  createPageRenderer,
} from '../src/index.js';
import type { ResolvedPage } from '../src/index.js';

describe('@formwork/ui: UIManager', () => {
  let ui: UIManager;

  beforeEach(() => { ui = new UIManager(); });

  describe('page resolution', () => {
    it('resolves page with component + props + url', async () => {
      const page = await ui.resolvePage('Users/Index', { users: [1, 2, 3] }, '/users');
      expect(page.component).toBe('Users/Index');
      expect(page.props['users']).toEqual([1, 2, 3]);
      expect(page.url).toBe('/users');
    });

    it('includes version', async () => {
      ui.setVersion('2.0.0');
      const page = await ui.resolvePage('Home', {}, '/');
      expect(page.version).toBe('2.0.0');
    });
  });

  describe('shared data', () => {
    it('merges shared data into all pages', async () => {
      ui.share('appName', 'Carpenter');
      ui.share('user', { id: 1, name: 'Alice' });

      const page = await ui.resolvePage('Dashboard', { stats: {} }, '/dashboard');
      expect(page.props['appName']).toBe('Carpenter');
      expect(page.props['user']).toEqual({ id: 1, name: 'Alice' });
      expect(page.props['stats']).toEqual({});
    });

    it('resolves lazy shared data (functions)', async () => {
      let callCount = 0;
      ui.share('notifications', () => { callCount++; return [{ id: 1, text: 'New message' }]; });

      const page = await ui.resolvePage('Home', {}, '/');
      expect(page.props['notifications']).toEqual([{ id: 1, text: 'New message' }]);
      expect(callCount).toBe(1);
    });

    it('resolves async shared data', async () => {
      ui.share('user', async () => ({ id: 1, name: 'Alice' }));
      const page = await ui.resolvePage('Home', {}, '/');
      expect(page.props['user']).toEqual({ id: 1, name: 'Alice' });
    });

    it('shareMany()', async () => {
      ui.shareMany({ a: 1, b: 2, c: 3 });
      const page = await ui.resolvePage('Home', {}, '/');
      expect(page.props['a']).toBe(1);
      expect(page.props['b']).toBe(2);
    });

    it('page-specific props override shared data', async () => {
      ui.share('title', 'Default');
      const page = await ui.resolvePage('Home', { title: 'Custom' }, '/');
      expect(page.props['title']).toBe('Custom');
    });
  });

  describe('rendering', () => {
    it('renders client-side shell without SSR', async () => {
      const html = await ui.render('Home', { greeting: 'Hello' }, '/');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('data-page=');
      expect(html).toContain('"component":"Home"');
      expect(html).toContain('"greeting":"Hello"');
    });

    it('uses renderer for SSR', async () => {
      const renderer = new MockRenderer();
      ui.setRenderer(renderer).ssr(true);

      const html = await ui.render('Dashboard', { stats: 42 }, '/dashboard');
      expect(html).toContain('data-component="Dashboard"');
      renderer.assertRendered('Dashboard');
    });

    it('rootView is configurable', () => {
      ui.setRootView('root');
      expect(ui.getRootView()).toBe('root');
    });
  });

  describe('configuration', () => {
    it('ssr toggle', () => {
      expect(ui.isSsrEnabled()).toBe(false);
      ui.ssr(true);
      expect(ui.isSsrEnabled()).toBe(true);
    });

    it('version', () => {
      ui.setVersion('3.0.0');
      expect(ui.getVersion()).toBe('3.0.0');
    });
  });
});

describe('@formwork/ui: ComponentRegistry', () => {
  let registry: ComponentRegistry;

  beforeEach(() => { registry = new ComponentRegistry(); });

  it('registers and resolves pages', () => {
    registry.page('Users/Index', './pages/Users/Index');
    expect(registry.resolve('Users/Index')).toBe('./pages/Users/Index');
    expect(registry.has('Users/Index')).toBe(true);
    expect(registry.resolve('Nope')).toBeNull();
  });

  it('registers layouts', () => {
    registry.layout('MainLayout', './layouts/Main');
    expect(registry.resolveLayout('MainLayout')).toBe('./layouts/Main');
  });

  it('autoRegister()', () => {
    registry.autoRegister('./pages', {
      'Users/Index': 'Users/Index.tsx',
      'Users/Show': 'Users/Show.tsx',
      'Dashboard': 'Dashboard.tsx',
    });

    expect(registry.resolve('Users/Index')).toBe('./pages/Users/Index.tsx');
    expect(registry.all().size).toBe(3);
  });
});

describe('@formwork/ui: MockRenderer', () => {
  it('records rendered pages', async () => {
    const renderer = new MockRenderer();
    await renderer.render({ component: 'Home', props: { x: 1 }, url: '/', version: '1' });
    await renderer.render({ component: 'About', props: {}, url: '/about', version: '1' });

    renderer.assertRendered('Home');
    renderer.assertRendered('About');
    renderer.assertCount(2);
  });

  it('assertRenderedWithProps()', async () => {
    const renderer = new MockRenderer();
    await renderer.render({ component: 'Users/Show', props: { user: { id: 1, name: 'Alice' } }, url: '/users/1', version: '1' });
    renderer.assertRenderedWithProps('Users/Show', { user: { id: 1, name: 'Alice' } });
  });

  it('throws on missing render', () => {
    const renderer = new MockRenderer();
    expect(() => renderer.assertRendered('Nope')).toThrow();
  });
});

describe('@formwork/ui: helpers', () => {
  it('createLink()', () => {
    const link = createLink('/users', { method: 'GET', preserveScroll: true });
    expect(link.href).toBe('/users');
    expect(link.method).toBe('GET');
    expect(link.preserveScroll).toBe(true);
  });

  it('createForm()', () => {
    const form = createForm('/users', 'POST', { name: '', email: '' });
    expect(form.action).toBe('/users');
    expect(form.method).toBe('POST');
    expect(form.processing).toBe(false);
    expect(form.errors).toEqual({});
  });
});

const testPage: ResolvedPage = {
  component: 'Users/Index',
  props: { users: [{ id: 1, name: 'Alice' }] },
  url: '/users',
  version: '1.0.0',
};

const mockResolve = (name: string) => name === 'Users/Index' ? {} : null;

describe('@formwork/ui-adapters: ReactPageRenderer', () => {
  it('renders page data into HTML shell', async () => {
    const renderer = new ReactPageRenderer({ resolve: mockResolve });
    const html = await renderer.render(testPage);
    expect(html).toContain('data-page=');
    expect(html).toContain('Users/Index');
  });

  it('throws for missing component', async () => {
    const renderer = new ReactPageRenderer({ resolve: () => null });
    await expect(renderer.render(testPage)).rejects.toThrow('not found');
  });

  it('uses custom element ID', async () => {
    const renderer = new ReactPageRenderer({ resolve: mockResolve, el: 'root' });
    const html = await renderer.render(testPage);
    expect(html).toContain('id="root"');
  });
});

describe('@formwork/ui-adapters: VuePageRenderer', () => {
  it('renders page', async () => {
    const renderer = new VuePageRenderer({ resolve: mockResolve });
    const html = await renderer.render(testPage);
    expect(html).toContain('Users/Index');
  });
});

describe('@formwork/ui-adapters: SveltePageRenderer', () => {
  it('renders page', async () => {
    const renderer = new SveltePageRenderer({ resolve: mockResolve });
    const html = await renderer.render(testPage);
    expect(html).toContain('Users/Index');
  });
});

describe('@formwork/ui-adapters: SolidPageRenderer', () => {
  it('renders page', async () => {
    const renderer = new SolidPageRenderer({ resolve: mockResolve });
    const html = await renderer.render(testPage);
    expect(html).toContain('Users/Index');
  });
});

describe('@formwork/ui-adapters: createPageRenderer', () => {
  it('creates React renderer', () => {
    const r = createPageRenderer('react', { resolve: mockResolve });
    expect(r).toBeInstanceOf(ReactPageRenderer);
  });

  it('creates Vue renderer', () => {
    expect(createPageRenderer('vue', { resolve: mockResolve })).toBeInstanceOf(VuePageRenderer);
  });

  it('creates Svelte renderer', () => {
    expect(createPageRenderer('svelte', { resolve: mockResolve })).toBeInstanceOf(SveltePageRenderer);
  });

  it('creates Solid renderer', () => {
    expect(createPageRenderer('solid', { resolve: mockResolve })).toBeInstanceOf(SolidPageRenderer);
  });

  it('throws for unknown framework', () => {
    expect(() => createPageRenderer('angular' as any, { resolve: mockResolve })).toThrow('Unknown');
  });
});
