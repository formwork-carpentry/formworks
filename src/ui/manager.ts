/**
 * @module @carpentry/ui
 * @description UIManager — page resolution, shared data, SSR
 * @patterns Facade
 */

import type { IPageRenderer, PageProps, ResolvedPage, SharedData } from "./types.js";

/**
 * Facade for SSR pages: shared view data, versioning, optional renderer, and `renderPage` orchestration.
 * Pair with `ComponentRegistry` and a framework `IPageRenderer` from `./components.js`.
 *
 * @example
 * ```ts
 * import { UIManager, MockRenderer } from './';
 * const ui = new UIManager().setRenderer(new MockRenderer()).enableSsr();
 * ```
 */
export class UIManager {
  private sharedData: SharedData = {};
  private version = "1.0.0";
  private renderer: IPageRenderer | null = null;
  private rootView = "app";
  private ssrEnabled = false;

  /** Set shared data (available on every page — auth user, flash messages, etc.) */
  /**
   * @param {string} key
   * @param {unknown | ((} value
   * @returns {this}
   */
  share(key: string, value: unknown | (() => unknown)): this {
    this.sharedData[key] = value;
    return this;
  }

  /** Set multiple shared data at once */
  /**
   * @param {SharedData} data
   * @returns {this}
   */
  shareMany(data: SharedData): this {
    Object.assign(this.sharedData, data);
    return this;
  }

  /** Set the asset version (for cache busting) */
  /**
   * @param {string} version
   * @returns {this}
   */
  setVersion(version: string): this {
    this.version = version;
    return this;
  }

  /** Set the page renderer (React/Vue/Svelte adapter) */
  /**
   * @param {IPageRenderer} renderer
   * @returns {this}
   */
  setRenderer(renderer: IPageRenderer): this {
    this.renderer = renderer;
    return this;
  }

  /** Set the root view template name */
  /**
   * @param {string} view
   * @returns {this}
   */
  setRootView(view: string): this {
    this.rootView = view;
    return this;
  }

  /** Enable/disable SSR */
  /**
   * @param {boolean} [enabled]
   * @returns {this}
   */
  ssr(enabled = true): this {
    this.ssrEnabled = enabled;
    return this;
  }

  /** Resolve a page with its props + shared data */
  /**
   * @param {string} component
   * @param {PageProps} props
   * @param {string} url
   * @returns {Promise<ResolvedPage>}
   */
  async resolvePage(component: string, props: PageProps, url: string): Promise<ResolvedPage> {
    const resolved = await this.resolveSharedData();
    return {
      component,
      props: { ...resolved, ...props },
      url,
      version: this.version,
    };
  }

  /** Render a page to HTML (for SSR or initial page load) */
  /**
   * @param {string} component
   * @param {PageProps} props
   * @param {string} url
   * @returns {Promise<string>}
   */
  async render(component: string, props: PageProps, url: string): Promise<string> {
    const page = await this.resolvePage(component, props, url);

    if (this.ssrEnabled && this.renderer) {
      return this.renderer.render(page);
    }

    // Client-side only — return a shell with JSON page data
    return this.renderShell(page);
  }

  /** Get the root view name */
  getRootView(): string {
    return this.rootView;
  }

  /** Check if SSR is enabled */
  isSsrEnabled(): boolean {
    return this.ssrEnabled;
  }

  /** Get current version */
  getVersion(): string {
    return this.version;
  }

  // ── Internal ────────────────────────────────────────────

  private async resolveSharedData(): Promise<PageProps> {
    const resolved: PageProps = {};
    for (const [key, value] of Object.entries(this.sharedData)) {
      resolved[key] = typeof value === "function" ? await value() : value;
    }
    return resolved;
  }

  private renderShell(page: ResolvedPage): string {
    const pageJson = JSON.stringify(page).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
<div id="${this.rootView}" data-page='${pageJson}'></div>
</body>
</html>`;
  }
}

// ── Component Registry — maps component names to paths ────
