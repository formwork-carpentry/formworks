import { describe, expect, it } from 'vitest';

import { MockRenderer } from '../../src/ui/components.js';
import { UIManager } from '../../src/ui/manager.js';

describe('ui/manager', () => {
  it('resolves shared data and lets page props override shared keys', async () => {
    const ui = new UIManager()
      .share('appName', 'Carpentry')
      .share('tenant', () => 'alpha')
      .share('locale', async () => 'en')
      .share('override', 'shared');

    const page = await ui.resolvePage('Dashboard', { override: 'prop' }, '/dashboard');

    expect(page.component).toBe('Dashboard');
    expect(page.url).toBe('/dashboard');
    expect(page.version).toBe('1.0.0');
    expect(page.props).toEqual({
      appName: 'Carpentry',
      tenant: 'alpha',
      locale: 'en',
      override: 'prop',
    });
  });

  it('renders shell when ssr is disabled', async () => {
    const ui = new UIManager().setRootView('root').setVersion('2.0.0');

    const html = await ui.render('Home', { text: '<unsafe>' }, '/');

    expect(html).toContain('<div id="root"');
    expect(html).toContain('\\u003cunsafe>');
    expect(ui.getRootView()).toBe('root');
    expect(ui.getVersion()).toBe('2.0.0');
    expect(ui.isSsrEnabled()).toBe(false);
  });

  it('uses configured renderer when ssr is enabled', async () => {
    const renderer = new MockRenderer();
    const ui = new UIManager().setRenderer(renderer).ssr();

    const html = await ui.render('Users/Index', { count: 2 }, '/users');

    expect(html).toContain('data-component="Users/Index"');
    expect(renderer.getRendered()).toHaveLength(1);
    expect(renderer.getRendered()[0]?.url).toBe('/users');
    expect(ui.isSsrEnabled()).toBe(true);
  });

  it('supports shareMany and disabling ssr explicitly', async () => {
    const ui = new UIManager().shareMany({ a: 1, b: 2 }).ssr(false);

    const page = await ui.resolvePage('Page', {}, '/p');

    expect(page.props).toMatchObject({ a: 1, b: 2 });
    expect(ui.isSsrEnabled()).toBe(false);
  });
});
