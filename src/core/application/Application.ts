/**
 * @module @carpentry/core
 * @description Application bootstrap — framework lifecycle manager
 * @patterns Singleton (Application.getInstance), Template Method (boot lifecycle)
 * @principles SRP — manages lifecycle only; OCP — providers extend behaviour; DIP — all via IoC
 */

import type { ServiceProvider } from "@carpentry/formworks/contracts/container";
import type { IContainer } from "@carpentry/formworks/contracts/container";
import { Config, env } from "../config/Config.js";
import type { ConfigRepository } from "../config/Config.js";
import { Container } from "../container/Container.js";
import { ContainerError } from "../exceptions/index.js";
import type { Dictionary, Token } from "../types/index.js";

export interface AppConfig {
  /** Configuration values keyed by namespace (e.g. { app: { name: '...' }, database: { ... } }) */
  config?: Dictionary;
  /** Service providers to register and boot */
  providers?: (new (
    app: IContainer,
  ) => ServiceProvider)[];
  /** Environment variables override (for testing) */
  env?: Dictionary<string>;
}

export const APP_LIFECYCLE_EVENTS = {
  BOOTING: "booting",
  BOOTED: "booted",
  TERMINATING: "terminating",
  TERMINATED: "terminated",
} as const;

type AppEvent = (typeof APP_LIFECYCLE_EVENTS)[keyof typeof APP_LIFECYCLE_EVENTS];

class ProviderLifecycleRegistry {
  private providers: ServiceProvider[] = [];
  private deferredProviders = new Map<Token, ServiceProvider>();

  registerProviders(
    app: IContainer,
    providerClasses: Array<new (app: IContainer) => ServiceProvider>,
  ): void {
    for (const ProviderClass of providerClasses) {
      const provider = new ProviderClass(app);

      if (provider.isDeferred()) {
        for (const token of provider.provides()) {
          this.deferredProviders.set(token, provider);
        }
      } else {
        provider.register();
      }

      this.providers.push(provider);
    }
  }

  async bootProviders(): Promise<void> {
    for (const provider of this.providers) {
      if (provider.isDeferred() && this.hasDeferredTokens(provider)) {
        continue;
      }
      await provider.boot();
    }
  }

  resolveDeferredProvider(token: Token): ServiceProvider | null {
    const provider = this.deferredProviders.get(token);
    if (!provider) {
      return null;
    }
    provider.register();
    this.deferredProviders.delete(token);
    return provider;
  }

  hasDeferredToken(token: Token): boolean {
    return this.deferredProviders.has(token);
  }

  private hasDeferredTokens(provider: ServiceProvider): boolean {
    return provider.provides().some((token) => this.deferredProviders.has(token));
  }
}

/**
 * Root IoC host: extends `Container` with config, service providers, and boot lifecycle.
 * Build via `Application.create`; then use `make`, `config`, and provider hooks like a full framework kernel.
 *
 * @example
 * ```ts
 * import { Application } from '..';
 * const app = await Application.create({ config: { app: { name: 'Demo' } }, providers: [] });
 * app.config('app.name');
 * ```
 */
export class Application extends Container {
  private static appInstance: Application | null = null;

  private configRepo: Config;
  private readonly providerRegistry = new ProviderLifecycleRegistry();
  private bootedFlag = false;
  private eventHandlers = new Map<AppEvent, Array<() => void | Promise<void>>>();

  private constructor() {
    super();
    this.configRepo = new Config();
  }

  // ── Singleton Access ────────────────────────────────────

  /**
   * Get the global application instance (Singleton pattern).
   *
   * @throws {ContainerError} if Application has not been created yet
   */
  static getInstance(): Application {
    if (!Application.appInstance) {
      throw new ContainerError(
        "Application has not been created. Call Application.create() first.",
      );
    }
    return Application.appInstance;
  }

  // ── Factory ─────────────────────────────────────────────

  /**
   * Create and bootstrap a new Application.
   *
   * Lifecycle: load env → load config → register providers → boot providers → ready
   *
   * @example
   * ```typescript
   * const app = await Application.create({
   *   config: { app: { name: 'MyApp', debug: true }, database: { default: 'sqlite' } },
   *   providers: [DatabaseServiceProvider, CacheServiceProvider],
   * });
   * ```
   */
  static async create(options: AppConfig = {}): Promise<Application> {
    const app = new Application();
    Application.appInstance = app;

    // 1. Load environment overrides (for testing)
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        process.env[key] = value;
      }
    }

    // 2. Load configuration
    if (options.config) {
      app.configRepo.merge(options.config);
    }

    // 3. Self-register core bindings
    app.instance("app", app);
    app.instance("config", app.configRepo);
    app.instance("env", env);

    // 4. Register all providers
    await app.dispatchLifecycleEvent(APP_LIFECYCLE_EVENTS.BOOTING);
    app.providerRegistry.registerProviders(app, options.providers ?? []);

    // 5. Boot all providers
    await app.providerRegistry.bootProviders();
    app.bootedFlag = true;
    await app.dispatchLifecycleEvent(APP_LIFECYCLE_EVENTS.BOOTED);

    return app;
  }

  // ── Config Access ───────────────────────────────────────

  /**
   * Get a configuration value.
   *
   * @param key - Dot-notation config key
   * @param defaultValue - Fallback value
   */
  config<T = unknown>(key: string, defaultValue?: T): T {
    return this.configRepo.get<T>(key, defaultValue);
  }

  /** Get the full config repository */
  getConfig(): ConfigRepository {
    return this.configRepo;
  }

  /** Whether boot() has completed */
  isBooted(): boolean {
    return this.bootedFlag;
  }

  // ── Event Hooks ─────────────────────────────────────────

  /**
   * Register a lifecycle event handler.
   *
   * @param event - 'booting' | 'booted' | 'terminating' | 'terminated'
   */
  on(event: AppEvent, handler: () => void | Promise<void>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(handler);
  }

  // ── Shutdown ────────────────────────────────────────────

  /**
   * Graceful shutdown — drain connections, flush queues, dispose resources.
   *
   * @param timeoutMs - Maximum time to wait for graceful shutdown (default: 5000ms)
   */
  async terminate(timeoutMs = 5000): Promise<void> {
    await this.dispatchLifecycleEvent(APP_LIFECYCLE_EVENTS.TERMINATING);

    const shutdownPromise = this.destroy();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    });

    await Promise.race([shutdownPromise, timeoutPromise]);
    await this.dispatchLifecycleEvent(APP_LIFECYCLE_EVENTS.TERMINATED);

    Application.appInstance = null;
  }

  /**
   * Override make() to support deferred providers.
   * If a token matches a deferred provider, register it on-demand.
   */
  override make<T>(abstract: Token<T>): T {
    if (!this.bound(abstract) && this.providerRegistry.hasDeferredToken(abstract)) {
      this.providerRegistry.resolveDeferredProvider(abstract);
    }

    return super.make<T>(abstract);
  }

  private async dispatchLifecycleEvent(event: AppEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      await handler();
    }
  }

  /** Reset for testing — clears the singleton */
  static resetInstance(): void {
    Application.appInstance = null;
  }
}
