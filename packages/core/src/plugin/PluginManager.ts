/**
 * @module @formwork/core
 * @description Plugin system — discover, register, and manage framework plugins
 * with lifecycle hooks, dependency resolution, and enable/disable control.
 *
 * WHY: Plugins allow third-party packages to extend Carpenter without forking.
 * A plugin can register service providers, add CLI commands, middleware,
 * routes, event listeners, and config defaults — all through a standard interface.
 *
 * HOW: Plugins implement the CarpenterPlugin interface. The PluginManager
 * loads them, resolves dependencies, and calls lifecycle hooks in order.
 *
 * @patterns Strategy (plugin implementations), Observer (lifecycle hooks), Registry (plugin catalog)
 * @principles OCP (extend without modifying core), DIP (depends on plugin interface)
 *
 * @example
 * ```ts
 * // Define a plugin
 * const stripePlugin: CarpenterPlugin = {
 *   name: 'carpenter-stripe',
 *   version: '1.0.0',
 *   description: 'Stripe payment integration',
 *   dependencies: ['@formwork/billing'],
 *
 *   register(app) {
 *     app.singleton('stripe', () => new StripeClient(env('STRIPE_KEY')));
 *   },
 *
 *   boot(app) {
 *     const router = app.make('router');
 *     router.post('/webhooks/stripe', stripeWebhookHandler);
 *   },
 * };
 *
 * // Use it
 * const manager = new PluginManager();
 * manager.add(stripePlugin);
 * await manager.bootAll(container);
 * ```
 */

import type { IContainer } from "../contracts/container/index.js";

// ── Plugin Interface ──────────────────────────────────────

/**
 * Interface that all Carpenter plugins must implement.
 * Only `name` and `version` are required — all hooks are optional.
 */
export interface CarpenterPlugin {
  /** Unique plugin name (e.g., 'carpenter-stripe', '@myorg/auth-plugin') */
  name: string;
  /** Semver version string */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Other plugins this one depends on (checked before boot) */
  dependencies?: string[];

  /**
   * Register phase — bind services into the container.
   * Called before boot(). Do NOT resolve other services here
   * (they may not be registered yet).
   */
  register?(app: IContainer): void;

  /**
   * Boot phase — resolve services, set up routes, middleware, etc.
   * Called after all plugins have been registered.
   */
  boot?(app: IContainer): void | Promise<void>;

  /**
   * Shutdown phase — cleanup resources (close connections, flush buffers).
   * Called when the application is shutting down.
   */
  shutdown?(): void | Promise<void>;

  /**
   * Config defaults — merged into the app config before providers run.
   * Use this to provide default configuration for your plugin.
   */
  configDefaults?(): Record<string, unknown>;
}

// ── Plugin State ──────────────────────────────────────────

/** Runtime state of a registered plugin */
export interface PluginState {
  plugin: CarpenterPlugin;
  enabled: boolean;
  registered: boolean;
  booted: boolean;
}

// ── Plugin Manager ────────────────────────────────────────

/**
 * PluginManager — central registry for all framework plugins.
 *
 * Lifecycle:
 * 1. add() — register plugins (order matters for dependencies)
 * 2. registerAll(container) — call register() on each enabled plugin
 * 3. bootAll(container) — call boot() on each enabled plugin
 * 4. shutdownAll() — call shutdown() on each plugin (reverse order)
 *
 * @example
 * ```ts
 * const manager = new PluginManager();
 *
 * manager.add(authPlugin);
 * manager.add(billingPlugin);
 * manager.add(stripePlugin); // depends on billingPlugin
 *
 * // Wire everything up
 * manager.registerAll(container);
 * await manager.bootAll(container);
 *
 * // On app shutdown
 * await manager.shutdownAll();
 * ```
 */
export class PluginManager {
  /** All registered plugins in add() order */
  private plugins = new Map<string, PluginState>();

  /**
   * Add a plugin to the manager.
   * Does NOT call register/boot — use registerAll/bootAll for that.
   *
   * @throws Error if a plugin with the same name is already registered
   */
  add(plugin: CarpenterPlugin): this {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }
    this.plugins.set(plugin.name, {
      plugin,
      enabled: true,
      registered: false,
      booted: false,
    });
    return this;
  }

  /**
   * Enable a previously disabled plugin.
   * Only affects future registerAll/bootAll calls.
   */
  enable(name: string): this {
    const state = this.getState(name);
    state.enabled = true;
    return this;
  }

  /**
   * Disable a plugin (skip it during register/boot).
   */
  disable(name: string): this {
    const state = this.getState(name);
    state.enabled = false;
    return this;
  }

  /**
   * Call register() on all enabled plugins.
   * Validates dependencies before registering.
   */
  registerAll(app: IContainer): void {
    this.validateDependencies();

    for (const state of this.plugins.values()) {
      if (!state.enabled || state.registered) continue;
      state.plugin.register?.(app);
      state.registered = true;
    }
  }

  /**
   * Call boot() on all enabled plugins.
   * Must be called after registerAll().
   */
  async bootAll(app: IContainer): Promise<void> {
    for (const state of this.plugins.values()) {
      if (!state.enabled || !state.registered || state.booted) continue;
      await state.plugin.boot?.(app);
      state.booted = true;
    }
  }

  /**
   * Call shutdown() on all plugins in reverse registration order.
   * Used during graceful application shutdown.
   */
  async shutdownAll(): Promise<void> {
    const reversed = [...this.plugins.values()].reverse();
    for (const state of reversed) {
      if (!state.booted) continue;
      await state.plugin.shutdown?.();
      state.booted = false;
    }
  }

  /**
   * Get merged config defaults from all enabled plugins.
   * Called before providers run to set default configuration.
   */
  getConfigDefaults(): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const state of this.plugins.values()) {
      if (!state.enabled) continue;
      const defaults = state.plugin.configDefaults?.();
      if (defaults) Object.assign(merged, defaults);
    }
    return merged;
  }

  /** Get state for a specific plugin */
  /**
   * @param {string} name
   * @returns {PluginState | undefined}
   */
  get(name: string): PluginState | undefined {
    return this.plugins.get(name);
  }

  /** Get all plugin names */
  getNames(): string[] {
    return [...this.plugins.keys()];
  }

  /** Get all enabled plugin names */
  getEnabledNames(): string[] {
    return [...this.plugins.entries()].filter(([, s]) => s.enabled).map(([name]) => name);
  }

  /** Check if a plugin is registered */
  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /** Get the total number of registered plugins */
  count(): number {
    return this.plugins.size;
  }

  // ── Internal ────────────────────────────────────────────

  /**
   * Validate that all plugin dependencies are satisfied.
   * @throws Error listing all missing dependencies
   */
  private validateDependencies(): void {
    const errors: string[] = [];

    for (const state of this.plugins.values()) {
      if (!state.enabled) continue;
      for (const dep of state.plugin.dependencies ?? []) {
        // Check if the dependency is registered AND enabled
        const depState = this.plugins.get(dep);
        if (!depState || !depState.enabled) {
          errors.push(
            `Plugin "${state.plugin.name}" requires "${dep}" which is not registered or disabled.`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Plugin dependency errors:\n  ${errors.join("\n  ")}`);
    }
  }

  private getState(name: string): PluginState {
    const state = this.plugins.get(name);
    if (!state) throw new Error(`Plugin "${name}" is not registered.`);
    return state;
  }
}
