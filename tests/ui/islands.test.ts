import { describe, expect, it } from 'vitest';

import { Island, IslandRenderer } from '../../src/ui/Islands.js';

describe('ui/Islands', () => {
  it('creates island definitions with lazy default hydration', () => {
    const Counter = Island({
      name: 'Counter',
      render: (props: { value: number }) => `<button>${props.value}</button>`,
    });

    expect(Counter.hydrate).toBe('lazy');
    expect(Counter.name).toBe('Counter');
  });

  it('renders wrapped island with escaped props and tracks used islands', () => {
    const renderer = new IslandRenderer();
    const Search = Island({
      name: 'Search',
      hydrate: 'eager',
      render: (props: { query: string }) => `<div>${props.query}</div>`,
    });

    const html = renderer.island(Search, { query: '<unsafe>' });

    expect(html).toContain('<carpenter-island');
    expect(html).toContain('data-island="Search"');
    expect(html).toContain('data-hydrate="eager"');
    expect(html).toContain('&quot;query&quot;:&quot;&lt;unsafe&gt;&quot;');
    expect(renderer.getUsedIslands()).toHaveLength(1);
  });

  it('appends loader script when islands are present and supports media attrs', () => {
    const renderer = new IslandRenderer();
    const Chart = Island({
      name: 'Chart',
      hydrate: 'media',
      mediaQuery: '(min-width: 1024px)',
      render: () => '<div>chart</div>',
    });

    const islandHtml = renderer.island(Chart, {});
    const pageHtml = renderer.renderPage(`<main>${islandHtml}</main>`);

    expect(pageHtml).toContain('<script type="module">');
    expect(pageHtml).toContain('Carpenter Islands Loader');
    expect(islandHtml).toContain('data-media="(min-width: 1024px)"');
  });

  it('resets used islands between renders', () => {
    const renderer = new IslandRenderer();
    const Widget = Island({
      name: 'Widget',
      render: () => '<div>w</div>',
    });

    renderer.island(Widget, {});
    expect(renderer.getUsedIslands()).toHaveLength(1);

    renderer.reset();
    expect(renderer.getUsedIslands()).toHaveLength(0);
    expect(renderer.renderPage('<p>no islands</p>')).toBe('<p>no islands</p>\n');
  });
});
