/**
 * @module @formwork/ui
 * @description UI types and renderer interface
 */

/**
 * @module @formwork/ui
 * @description Framework-agnostic UI layer — page resolution, shared data, SSR, component registry
 *
 * This is the server-side abstraction. Framework-specific packages (ui-react, ui-vue, ui-svelte, ui-solid)
 * consume this to render pages. Works like Inertia.js — server returns page name + props,
 * client renders the matching component.
 *
 * @patterns Strategy (renderers), Registry (pages/components), Mediator (page resolution)
 * @principles OCP — new UI frameworks via adapter; DIP — server code never imports React/Vue/etc.
 */

// ── Page Resolution ───────────────────────────────────────

export interface PageProps {
  [key: string]: unknown;
}

export interface ResolvedPage {
  component: string;
  props: PageProps;
  url: string;
  version: string;
}

export interface SharedData {
  [key: string]: unknown | (() => unknown) | (() => Promise<unknown>);
}

// ── Page Renderer Interface ───────────────────────────────

export interface IPageRenderer {
  /** Render a page to HTML (SSR) */
  /**
   * @param {ResolvedPage} page
   * @returns {Promise<string>}
   */
  render(page: ResolvedPage): Promise<string>;
}

// ── UI Manager ────────────────────────────────────────────
