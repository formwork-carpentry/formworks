/**
 * @module @carpentry/core
 * @description Application bootstrap — framework lifecycle manager
 * @patterns Singleton (Application.getInstance), Template Method (boot lifecycle)
 * @principles SRP — manages lifecycle only; OCP — providers extend behaviour; DIP — all via IoC
 */

import { Config, env } from "../config/Config.js";
import type { ConfigRepository } from "../config/Config.js";
import { Container } from "../container/Container.js";
import type { ServiceProvider } from "../../contracts/container/index.js";
import type { IContainer } from "../../contracts/container/index.js";
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

type AppEvent = "booting" | "booted" | "terminating" | "terminated";

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
  private providers: ServiceProvider[] = [];
  private deferredProviders = new Map<Token, ServiceProvider>();
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
    await app.emitEvent("booting");
    app.registerProviders(options.providers ?? []);

    // 5. Boot all providers
    await app.bootProviders();
    app.bootedFlag = true;
    await app.emitEvent("booted");

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
    await this.emitEvent("terminating");

    const shutdownPromise = this.destroy();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    });

    await Promise.race([shutdownPromise, timeoutPromise]);
    await this.emitEvent("terminated");

    Application.appInstance = null;
  }

  /**
   * Override make() to support deferred providers.
   * If a token matches a deferred provider, register it on-demand.
   */
  override make<T>(abstract: Token<T>): T {
    // Check if a deferred provider handles this token
    if (!this.bound(abstract) && this.deferredProviders.has(abstract)) {
      const provider = this.deferredProviders.get(abstract);
      if (provider) {
        provider.register();
        this.deferredProviders.delete(abstract);
      }
    }

    return super.make<T>(abstract);
  }

  // ── Internal ────────────────────────────────────────────

  private registerProviders(providerClasses: (new (app: IContainer) => ServiceProvider)[]): void {
    for (const ProviderClass of providerClasses) {
      const provider = new ProviderClass(this);

      if (provider.isDeferred()) {
        // Deferred: register when one of its tokens is first requested
        for (const token of provider.provides()) {
          this.deferredProviders.set(token, provider);
        }
      } else {
        provider.register();
      }

      this.providers.push(provider);
    }
  }

  private async bootProviders(): Promise<void> {
    for (const provider of this.providers) {
      // Skip deferred providers that haven't been registered yet
      if (provider.isDeferred() && this.hasDeferredTokens(provider)) {
        continue;
      }
      await provider.boot();
    }
  }

  private hasDeferredTokens(provider: ServiceProvider): boolean {
    return provider.provides().some((token) => this.deferredProviders.has(token));
  }

  private async emitEvent(event: AppEvent): Promise<void> {
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
