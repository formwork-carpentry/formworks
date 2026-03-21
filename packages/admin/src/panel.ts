/**
 * @module @formwork/admin
 * @description AdminPanel — registers resources and builds navigation
 * @patterns Facade
 */

import type { AdminResource } from "./resource.js";
import type { DashboardWidget, NavItem } from "./types.js";

// ── Admin Panel ───────────────────────────────────────────

/**
 * AdminPanel coordinates admin resources, dashboard widgets, and navigation.
 *
 Typically you:
 * 1. Create one or more {@link AdminResource} instances with fields/filters/actions.
 * 2. Register them via {@link register()}.
 * 3. Call {@link autoNav()} (or {@link nav()}) to build the UI navigation model.
 *
 * @example
 * ```ts
 * const panel = new AdminPanel()
 *   .setPath('/admin')
 *   .register(
 *     new AdminResource({ name: 'users', label: 'User' })
 *       .id()
 *       .text('name'),
 *   )
 *   .autoNav();
 * ```
 */
export class AdminPanel {
  private resources = new Map<string, AdminResource>();
  private widgets: DashboardWidget[] = [];
  private navigation: NavItem[] = [];
  private path = "/admin";

  /** Register an admin resource */
  /**
   * @param {AdminResource} resource
   * @returns {this}
   */
  register(resource: AdminResource): this {
    this.resources.set(resource.name, resource);
    return this;
  }

  /** Add a dashboard widget */
  /**
   * @param {DashboardWidget} widget
   * @returns {this}
   */
  widget(widget: DashboardWidget): this {
    this.widgets.push(widget);
    return this;
  }

  /** Set navigation structure */
  /**
   * @param {NavItem[]} items
   * @returns {this}
   */
  nav(items: NavItem[]): this {
    this.navigation = items;
    return this;
  }

  /** Auto-generate navigation from registered resources */
  autoNav(): this {
    this.navigation = [...this.resources.values()].map((r) => ({
      label: r.labelPlural,
      icon: r.icon,
      resource: r.name,
      route: `${this.path}/${r.name}`,
    }));
    return this;
  }

  /** Set the admin base path */
  /**
   * @param {string} path
   * @returns {this}
   */
  setPath(path: string): this {
    this.path = path;
    return this;
  }

  // ── Getters ─────────────────────────────────────────────

  /**
   * @param {string} name
   * @returns {AdminResource | undefined}
   */
  getResource(name: string): AdminResource | undefined {
    return this.resources.get(name);
  }
  getResources(): AdminResource[] {
    return [...this.resources.values()];
  }
  getResourceNames(): string[] {
    return [...this.resources.keys()];
  }
  getWidgets(): DashboardWidget[] {
    return [...this.widgets];
  }
  getNavigation(): NavItem[] {
    return [...this.navigation];
  }
  getPath(): string {
    return this.path;
  }
  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasResource(name: string): boolean {
    return this.resources.has(name);
  }

  /** Resolve dashboard data (all widgets) */
  async resolveDashboard(): Promise<Map<string, unknown>> {
    const data = new Map<string, unknown>();
    for (const widget of this.widgets) {
      data.set(widget.name, await widget.resolve());
    }
    return data;
  }
}
