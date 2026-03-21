/**
 * @module @formwork/ui
 * @description Islands Architecture — render server-side HTML with selectively hydrated
 * interactive "islands" of client-side JavaScript.
 *
 * WHY: Traditional SPAs ship the entire framework to the browser, even for mostly-static
 * pages. Islands architecture renders HTML on the server and only hydrates the parts
 * that need interactivity (forms, charts, dropdowns). This cuts JS payload by 80-95%
 * for content-heavy sites (blogs, docs, e-commerce).
 *
 * HOW: Mark components as islands with `Island()`. The server renders all components
 * to HTML. Islands get a `<carpenter-island>` wrapper with serialized props. The client
 * loader only hydrates these wrappers, leaving static HTML untouched.
 *
 * @patterns Decorator (island marking), Builder (HTML assembly), Strategy (hydration modes)
 * @principles SRP (hydration orchestration only), OCP (add island types without modifying renderer)
 *
 * @example
 * ```ts
 * // Define an island component
 * const Counter = Island({
 *   name: 'Counter',
 *   // Server-render: returns HTML string
 *   render: (props: { initial: number }) => `<button>Count: ${props.initial}</button>`,
 *   // Client-side: hydrates the HTML with interactivity
 *   hydrate: 'eager',  // 'eager' | 'lazy' | 'visible' | 'idle' | 'media'
 * });
 *
 * // In a page template
 * const page = new IslandRenderer();
 * const html = page.render(`
 *   <h1>My Page</h1>
 *   <p>This is static HTML — zero JS.</p>
 *   ${page.island(Counter, { initial: 0 })}
 *   <footer>Also static.</footer>
 * `);
 * ```
 */

// ── Types ─────────────────────────────────────────────────

/**
 * Hydration strategy — controls when the island's JS is loaded and executed.
 *
 * - 'eager': Hydrate immediately on page load (for above-the-fold interactivity)
 * - 'lazy': Hydrate when the island scrolls into the viewport (IntersectionObserver)
 * - 'visible': Same as lazy but with a larger rootMargin (pre-hydrate before visible)
 * - 'idle': Hydrate when the browser is idle (requestIdleCallback)
 * - 'media': Hydrate when a media query matches (e.g., only on desktop)
 * - 'none': Never hydrate — purely server-rendered (useful for opt-out)
 */
export type HydrationStrategy = "eager" | "lazy" | "visible" | "idle" | "media" | "none";

/** Definition of an island component */
export interface IslandDefinition<P = Record<string, unknown>> {
  /** Unique component name (used for client-side module resolution) */
  name: string;
  /** Server-side render function — returns an HTML string */
  render: (props: P) => string;
  /** When to hydrate on the client (default: 'lazy') */
  hydrate?: HydrationStrategy;
  /** Media query for 'media' hydration strategy */
  mediaQuery?: string;
  /** Path to the client-side component module (for code splitting) */
  clientEntry?: string;
}

/** A rendered island ready for embedding in HTML */
export interface RenderedIsland {
  /** The full HTML including the wrapper element */
  html: string;
  /** Serialized props for client-side hydration */
  props: string;
  /** The island component name */
  name: string;
  /** Hydration strategy */
  strategy: HydrationStrategy;
}

// ── Island Factory ────────────────────────────────────────

/**
 * Create an island component definition.
 *
 * @example
 * ```ts
 * const SearchBar = Island({
 *   name: 'SearchBar',
 *   render: (props: { placeholder: string }) =>
 *     `<input type="search" placeholder="${props.placeholder}" />`,
 *   hydrate: 'eager',  // Search bar needs immediate interactivity
 * });
 *
 * const Chart = Island({
 *   name: 'Chart',
 *   render: (props: { data: number[] }) =>
 *     `<div class="chart-placeholder">Loading chart...</div>`,
 *   hydrate: 'visible',  // Only load chart JS when scrolled into view
 *   clientEntry: '/islands/Chart.tsx',
 * });
 * ```
 */
export function Island<P = Record<string, unknown>>(
  definition: IslandDefinition<P>,
): IslandDefinition<P> {
  return {
    ...definition,
    hydrate: definition.hydrate ?? "lazy",
  };
}

// ── Island Renderer ───────────────────────────────────────

/**
 * IslandRenderer — renders pages with embedded islands.
 *
 * Server-side workflow:
 * 1. Render the page template (static HTML + island placeholders)
 * 2. Each island is server-rendered and wrapped in `<carpenter-island>`
 * 3. Props are serialized as a `data-props` attribute for client hydration
 * 4. The client loader script is appended to handle hydration
 *
 * @example
 * ```ts
 * const renderer = new IslandRenderer();
 *
 * const html = renderer.renderPage(`
 *   <h1>Dashboard</h1>
 *   ${renderer.island(UserAvatar, { userId: '42' })}
 *   <p>Static content here...</p>
 *   ${renderer.island(ActivityChart, { data: [1, 2, 3] })}
 * `);
 *
 * // html includes:
 * // - The static HTML (no JS needed)
 * // - <carpenter-island> wrappers around interactive parts
 * // - A tiny loader script that hydrates islands based on strategy
 * ```
 */
export class IslandRenderer {
  /** All islands used in the current page (for generating the loader script) */
  private usedIslands: RenderedIsland[] = [];

  /**
   * Render an island component and return HTML for embedding in a page template.
   *
   * @param definition - The island component definition (from Island())
   * @param props - Props to pass to the component's render function
   * @returns HTML string with the island wrapper
   */
  island<P>(definition: IslandDefinition<P>, props: P): string {
    // Server-render the component's HTML
    const innerHtml = definition.render(props);

    // Serialize props for client-side hydration
    const serializedProps = JSON.stringify(props);
    const strategy = definition.hydrate ?? "lazy";
    const clientEntry = definition.clientEntry ?? `/islands/${definition.name}.js`;

    // Build the wrapper element
    // The custom element <carpenter-island> is picked up by the client loader
    const attrs = [
      `data-island="${definition.name}"`,
      `data-props="${this.escapeAttr(serializedProps)}"`,
      `data-hydrate="${strategy}"`,
      `data-entry="${clientEntry}"`,
    ];

    if (strategy === "media" && definition.mediaQuery) {
      attrs.push(`data-media="${definition.mediaQuery}"`);
    }

    const html = `<carpenter-island ${attrs.join(" ")}>${innerHtml}</carpenter-island>`;

    // Track for loader script generation
    this.usedIslands.push({ html, props: serializedProps, name: definition.name, strategy });

    return html;
  }

  /**
   * Wrap a page template with the necessary island loader script.
   * Call this AFTER all island() calls for the page.
   *
   * @param bodyHtml - The full page body HTML (including island() outputs)
   * @returns Complete HTML with the loader script appended
   */
  renderPage(bodyHtml: string): string {
    const loaderScript = this.generateLoaderScript();
    return `${bodyHtml}\n${loaderScript}`;
  }

  /** Get all islands used in the current page */
  getUsedIslands(): ReadonlyArray<RenderedIsland> {
    return this.usedIslands;
  }

  /** Reset for a new page render */
  reset(): void {
    this.usedIslands = [];
  }

  // ── Internal ────────────────────────────────────────────

  /**
   * Generate the client-side island loader script.
   *
   * This tiny script (~500 bytes gzipped) handles all hydration strategies:
   * - eager: hydrate immediately
   * - lazy/visible: use IntersectionObserver
   * - idle: use requestIdleCallback
   * - media: use matchMedia
   */
  private generateLoaderScript(): string {
    if (this.usedIslands.length === 0) return "";

    // Deduplicate island names for import map
    const uniqueIslands = [...new Set(this.usedIslands.map((i) => i.name))];
    if (uniqueIslands.length === 0) return "";

    return `<script type="module">
// Carpenter Islands Loader — hydrates interactive islands on the page
document.querySelectorAll('carpenter-island').forEach(el => {
  const strategy = el.dataset.hydrate;
  const hydrate = async () => {
    const mod = await import(el.dataset.entry);
    const props = JSON.parse(el.dataset.props);
    if (mod.default?.hydrate) mod.default.hydrate(el, props);
    else if (mod.hydrate) mod.hydrate(el, props);
    el.setAttribute('data-hydrated', 'true');
  };

  /**
   * @param {unknown} [strategy === 'eager']
   */
  if (strategy === 'eager') { hydrate(); }
  else if (strategy === 'lazy' || strategy === 'visible') {
    const margin = strategy === 'visible' ? '200px' : '0px';
    new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { obs.disconnect(); hydrate(); }
    }, { rootMargin: margin }).observe(el);
  }
  else if (strategy === 'idle') {
    (window.requestIdleCallback || setTimeout)(hydrate);
  }
  else if (strategy === 'media') {
    const mq = window.matchMedia(el.dataset.media || 'all');
    if (mq.matches) hydrate();
    else mq.addEventListener('change', e => { if (e.matches) hydrate(); }, { once: true });
  }
});
</script>`;
  }

  /** Escape a string for use in an HTML attribute value */
  private escapeAttr(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
