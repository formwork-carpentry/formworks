/**
 * @module @formwork/ui
 * @description ComponentRegistry, helpers, MockRenderer, adapters, factory
 * @patterns Factory Method, Strategy, Adapter
 */

import type { IPageRenderer, PageProps, ResolvedPage } from "./types.js";

/**
 * Maps logical page and layout names to on-disk component paths for resolvers and SSR adapters.
 *
 * @example
 * ```ts
 * import { ComponentRegistry } from '@formwork/ui';
 * const reg = new ComponentRegistry().page('home', './pages/Home.tsx').layout('main', './layouts/Main.tsx');
 * reg.resolve('home');
 * ```
 */
export class ComponentRegistry {
  private components = new Map<string, string>();
  private layouts = new Map<string, string>();

  /** Register a page component */
  /**
   * @param {string} name
   * @param {string} path
   * @returns {this}
   */
  page(name: string, path: string): this {
    this.components.set(name, path);
    return this;
  }

  /** Register a layout component */
  /**
   * @param {string} name
   * @param {string} path
   * @returns {this}
   */
  layout(name: string, path: string): this {
    this.layouts.set(name, path);
    return this;
  }

  /** Auto-register from a glob-like pattern (stores path patterns) */
  /**
   * @param {string} basePath
   * @param {Record<string, string>} pages
   * @returns {this}
   */
  autoRegister(basePath: string, pages: Record<string, string>): this {
    for (const [name, path] of Object.entries(pages)) {
      this.components.set(name, `${basePath}/${path}`);
    }
    return this;
  }

  /**
   * @param {string} name
   * @returns {string | null}
   */
  resolve(name: string): string | null {
    return this.components.get(name) ?? null;
  }
  /**
   * @param {string} name
   * @returns {string | null}
   */
  resolveLayout(name: string): string | null {
    return this.layouts.get(name) ?? null;
  }
  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name: string): boolean {
    return this.components.has(name);
  }
  all(): Map<string, string> {
    return new Map(this.components);
  }
  allLayouts(): Map<string, string> {
    return new Map(this.layouts);
  }
}

// ── Link/Form helpers (framework-agnostic data) ───────────

export interface LinkData {
  href: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: Record<string, unknown>;
  preserveScroll?: boolean;
  preserveState?: boolean;
  replace?: boolean;
}

/**
 * @param {string} href
 * @param {Partial<LinkData>} [options]
 * @returns {LinkData}
 */
export function createLink(href: string, options?: Partial<LinkData>): LinkData {
  return { href, method: "GET", ...options };
}

export interface FormData {
  action: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  fields: Record<string, unknown>;
  errors?: Record<string, string[]>;
  processing?: boolean;
}

/**
 * @param {string} action
 * @param {'POST' | 'PUT' | 'PATCH' | 'DELETE'} method
 * @param {Object} fields
 * @returns {FormData}
 */
export function createForm(
  action: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  fields: Record<string, unknown>,
): FormData {
  return { action, method, fields, errors: {}, processing: false };
}

// ── Mock Renderer (for testing) ───────────────────────────

/**
 * Captures `ResolvedPage` payloads as JSON in a div — use in tests instead of React/Vue SSR.
 *
 * @example
 * ```ts
 * import { MockRenderer } from '@formwork/ui';
 * const r = new MockRenderer();
 * await r.render({ component: 'Home', props: {}, layout: null, meta: {} });
 * ```
 */
export class MockRenderer implements IPageRenderer {
  private rendered: ResolvedPage[] = [];

  /**
   * @param {ResolvedPage} page
   * @returns {Promise<string>}
   */
  async render(page: ResolvedPage): Promise<string> {
    this.rendered.push(page);
    return `<div data-component="${page.component}">${JSON.stringify(page.props)}</div>`;
  }

  getRendered(): ResolvedPage[] {
    return [...this.rendered];
  }

  /**
   * @param {string} component
   */
  assertRendered(component: string): void {
    if (!this.rendered.some((p) => p.component === component)) {
      throw new Error(`Expected "${component}" to be rendered, but it was not.`);
    }
  }

  /**
   * @param {string} component
   * @param {Partial<PageProps>} props
   */
  assertRenderedWithProps(component: string, props: Partial<PageProps>): void {
    const page = this.rendered.find((p) => p.component === component);
    if (!page) throw new Error(`Component "${component}" not rendered.`);
    for (const [key, value] of Object.entries(props)) {
      if (JSON.stringify(page.props[key]) !== JSON.stringify(value)) {
        throw new Error(
          `Prop "${key}" mismatch. Expected: ${JSON.stringify(value)}, Got: ${JSON.stringify(page.props[key])}`,
        );
      }
    }
  }

  /**
   * @param {number} n
   */
  assertCount(n: number): void {
    if (this.rendered.length !== n)
      throw new Error(`Expected ${n} renders, got ${this.rendered.length}.`);
  }

  reset(): void {
    this.rendered = [];
  }
}
/**
 * @module @formwork/ui-adapters
 * @description UI framework adapters — React, Vue, Svelte, Solid renderers for @formwork/ui
 *
 * Each adapter implements IPageRenderer to render pages in its framework.
 * In production, these use the actual framework's SSR APIs.
 * Here we provide the interface + mock implementations for testing.
 *
 * @patterns Adapter (each normalizes a framework to IPageRenderer), Factory (createApp)
 * @principles DIP — server code depends on IPageRenderer, never on React/Vue directly
 */

// ── Adapter Config ────────────────────────────────────────

export interface UIAdapterConfig {
  /** Component resolver — maps component names to actual components */
  resolve: (name: string) => unknown;
  /** Root element ID */
  el?: string;
  /** Enable SSR */
  ssr?: boolean;
  /** Page title resolver */
  title?: (page: ResolvedPage) => string;
  /** Setup function called before rendering each page */
  setup?: (props: PageProps) => void;
}

// ── React Adapter ─────────────────────────────────────────

/**
 * `IPageRenderer` stub for React: resolves the component and emits a hydration-friendly root div.
 *
 * @example
 * ```ts
 * import { ReactPageRenderer } from '@formwork/ui';
 * new ReactPageRenderer({ resolve: (n) => components[n] });
 * ```
 */
export class ReactPageRenderer implements IPageRenderer {
  private config: UIAdapterConfig;

  constructor(config: UIAdapterConfig) {
    this.config = config;
  }

  /**
   * @param {ResolvedPage} page
   * @returns {Promise<string>}
   */
  async render(page: ResolvedPage): Promise<string> {
    const component = this.config.resolve(page.component);
    if (!component) throw new Error(`React component "${page.component}" not found.`);

    // In production, this would use ReactDOMServer.renderToString()
    // For now, return a JSON-serialized placeholder
    return `<div id="${this.config.el ?? "app"}" data-page='${JSON.stringify(page).replace(/</g, "\\u003c")}'></div>`;
  }

  getConfig(): UIAdapterConfig {
    return this.config;
  }
}

// ── Vue Adapter ───────────────────────────────────────────

/**
 * `IPageRenderer` stub for Vue — same contract as `ReactPageRenderer`.
 *
 * @example
 * ```ts
 * import { VuePageRenderer } from '@formwork/ui';
 * new VuePageRenderer({ resolve: (n) => pages[n] });
 * ```
 */
export class VuePageRenderer implements IPageRenderer {
  private config: UIAdapterConfig;

  constructor(config: UIAdapterConfig) {
    this.config = config;
  }

  /**
   * @param {ResolvedPage} page
   * @returns {Promise<string>}
   */
  async render(page: ResolvedPage): Promise<string> {
    const component = this.config.resolve(page.component);
    if (!component) throw new Error(`Vue component "${page.component}" not found.`);

    // In production, this would use @vue/server-renderer
    return `<div id="${this.config.el ?? "app"}" data-page='${JSON.stringify(page).replace(/</g, "\\u003c")}'></div>`;
  }

  getConfig(): UIAdapterConfig {
    return this.config;
  }
}

// ── Svelte Adapter ────────────────────────────────────────

/**
 * `IPageRenderer` stub for Svelte — same contract as `ReactPageRenderer`.
 *
 * @example
 * ```ts
 * import { SveltePageRenderer } from '@formwork/ui';
 * new SveltePageRenderer({ resolve: (n) => routes[n] });
 * ```
 */
export class SveltePageRenderer implements IPageRenderer {
  private config: UIAdapterConfig;

  constructor(config: UIAdapterConfig) {
    this.config = config;
  }

  /**
   * @param {ResolvedPage} page
   * @returns {Promise<string>}
   */
  async render(page: ResolvedPage): Promise<string> {
    const component = this.config.resolve(page.component);
    if (!component) throw new Error(`Svelte component "${page.component}" not found.`);

    // In production, this would use Svelte's server-side render
    return `<div id="${this.config.el ?? "app"}" data-page='${JSON.stringify(page).replace(/</g, "\\u003c")}'></div>`;
  }

  getConfig(): UIAdapterConfig {
    return this.config;
  }
}

// ── Solid Adapter ─────────────────────────────────────────

/**
 * `IPageRenderer` stub for Solid — same contract as `ReactPageRenderer`.
 *
 * @example
 * ```ts
 * import { SolidPageRenderer } from '@formwork/ui';
 * new SolidPageRenderer({ resolve: (n) => views[n] });
 * ```
 */
export class SolidPageRenderer implements IPageRenderer {
  private config: UIAdapterConfig;

  constructor(config: UIAdapterConfig) {
    this.config = config;
  }

  /**
   * @param {ResolvedPage} page
   * @returns {Promise<string>}
   */
  async render(page: ResolvedPage): Promise<string> {
    const component = this.config.resolve(page.component);
    if (!component) throw new Error(`Solid component "${page.component}" not found.`);

    // In production, this would use solid-js/web renderToString
    return `<div id="${this.config.el ?? "app"}" data-page='${JSON.stringify(page).replace(/</g, "\\u003c")}'></div>`;
  }

  getConfig(): UIAdapterConfig {
    return this.config;
  }
}

// ── createApp helper — factory for the right adapter ──────

export type UIFramework = "react" | "vue" | "svelte" | "solid";

/**
 * @param {UIFramework} framework
 * @param {UIAdapterConfig} config
 * @returns {IPageRenderer}
 */
export function createPageRenderer(framework: UIFramework, config: UIAdapterConfig): IPageRenderer {
  /**
   * @param {unknown} framework
   */
  switch (framework) {
    case "react":
      return new ReactPageRenderer(config);
    case "vue":
      return new VuePageRenderer(config);
    case "svelte":
      return new SveltePageRenderer(config);
    case "solid":
      return new SolidPageRenderer(config);
    default:
      throw new Error(`Unknown UI framework: ${framework}`);
  }
}
