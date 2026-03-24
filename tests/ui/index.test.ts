import { describe, expect, it } from 'vitest';

import {
  ComponentRegistry,
  Island,
  IslandRenderer,
  MockRenderer,
  UIManager,
  useForm,
} from '../../src/ui/index.js';

describe('ui/index', () => {
  it('re-exports core ui managers, helpers, and island utilities', async () => {
    const manager = new UIManager().setRenderer(new MockRenderer()).ssr();
    const registry = new ComponentRegistry().page('home', './pages/Home.tsx');
    const islandRenderer = new IslandRenderer();
    const Widget = Island({ name: 'Widget', render: () => '<div>ok</div>' });
    const form = useForm({ name: 'A' });

    const islandHtml = islandRenderer.island(Widget, {});
    const pageHtml = await manager.render('Home', { ok: true }, '/');

    expect(registry.resolve('home')).toBe('./pages/Home.tsx');
    expect(islandHtml).toContain('carpenter-island');
    expect(pageHtml).toContain('data-component="Home"');
    expect(form.data.name).toBe('A');
  });
});
