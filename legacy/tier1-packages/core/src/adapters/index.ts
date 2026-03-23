/**
 * @module @carpentry/core
 * @description AdapterBase — abstract base for domain factory managers.
 *
 * Implements the shared pattern used across all Carpenter infrastructure domains
 * (database, cache, queue, mail, storage, bridge): driver registration, lazy adapter
 * construction, instance caching, and fail-fast resolution.
 *
 * @patterns Abstract Factory (creates adapters by driver name), Strategy (runtime driver selection)
 * @principles DRY (one implementation, six domains), OCP (new drivers via registerDriver),
 *             DIP (app code uses contracts, never concrete adapters)
 *
 * @example
 * ```ts
 * import { CarpenterFactoryBase } from '@carpentry/core/adapters';
 * import type { AdapterDriverFactory } from '@carpentry/core/adapters';
 *
 * interface ICacheStore { get(key: string): Promise<unknown>; }
 * interface CacheConfig { driver: string; path?: string; }
 *
 * class CacheManager extends CarpenterFactoryBase<ICacheStore, CacheConfig> {
 *   protected readonly resolverLabel = 'store';
 *   protected readonly domainLabel = 'Cache';
 *
 *   store(name?: string): ICacheStore { return this.resolve(name); }
 * }
 * ```
 *
 * @see CarpenterFactoryAdapter — Factory function type for creating adapter instances
 */

/**
 * Factory function that creates an adapter instance from a config object.
 *
 * @param config - The driver-specific configuration (always includes `driver`).
 * @returns A fully constructed adapter instance.
 */
export type CarpenterFactoryAdapter<
  TConfig extends { driver: string } = { driver: string; [key: string]: unknown },
  TAdapter = unknown,
> = (config: TConfig) => TAdapter;

/**
 * Abstract base class for domain factory managers.
 *
 * Each domain manager (Database, Cache, Queue, Mail, Storage, Bridge) extends this
 * class and adds a thin domain-specific API on top — e.g. `connection()`, `store()`,
 * `disk()`, `mailer()`, `transport()`.
 *
 * @example
 * ```ts
 * class DatabaseManager extends CarpenterFactoryBase<IDatabaseAdapter, DatabaseConnectionConfig> {
 *   protected readonly resolverLabel = 'connection';
 *   protected readonly domainLabel = 'Database';
 *
 *   connection(name?: string): IDatabaseAdapter { return this.resolve(name); }
 * }
 *
 * const mgr = new DatabaseManager('sqlite', { sqlite: { driver: 'sqlite', database: ':memory:' } });
 * mgr.registerDriver('sqlite', (cfg) => new SQLiteAdapter(cfg));
 * const db = mgr.connection(); // lazy-creates and caches the adapter
 * ```
 */
export abstract class CarpenterFactoryBase<
  TAdapter,
  TConfig extends { driver: string; [key: string]: unknown } = {
    driver: string;
    [key: string]: unknown;
  },
> {
  /** Cached adapter instances keyed by connection/store/disk name. */
  private readonly instances = new Map<string, TAdapter>();

  /** Registered driver factories keyed by driver name. */
  private readonly drivers = new Map<string, CarpenterFactoryAdapter<TConfig, TAdapter>>();

  /**
   * @param defaultName - The name used when no explicit name is passed to `resolve()`.
   * @param configs - Map of named configurations, each with at least a `driver` key.
   */
  constructor(
    private defaultName: string,
    private readonly configs: Record<string, TConfig>,
  ) {}

  // ── Subclass hooks ──────────────────────────────────────

  /** Human-readable label for what a resolved instance is called (e.g. "connection", "store", "disk"). */
  protected abstract readonly resolverLabel: string;

  /** Human-readable domain name for error messages (e.g. "Database", "Cache"). */
  protected abstract readonly domainLabel: string;

  // ── Driver registration ─────────────────────────────────

  /**
   * Register a driver factory.
   *
   * @param name - Driver name (e.g. 'sqlite', 'redis', 's3').
   * @param factory - Factory function that creates an adapter from config.
   * @returns `this` for fluent chaining.
   *
   * @example
   * ```ts
   * manager
   *   .registerDriver('redis', (cfg) => new RedisCacheStore(cfg))
   *   .registerDriver('file', (cfg) => new FileCacheStore(cfg));
   * ```
   */
  registerDriver(name: string, factory: CarpenterFactoryAdapter<TConfig, TAdapter>): this {
    this.drivers.set(name, factory);
    return this;
  }

  /**
   * Check whether a driver factory has been registered.
   *
   * @param name - Driver name to check.
   * @returns `true` if the driver is registered.
   */
  hasDriver(name: string): boolean {
    return this.drivers.has(name);
  }

  /**
   * Get all registered driver names.
   *
   * @returns Array of driver names (e.g. `['memory', 'redis', 'file']`).
   */
  getDriverNames(): string[] {
    return [...this.drivers.keys()];
  }

  // ── Configuration ───────────────────────────────────────

  /**
   * Get all configured names (connection names, store names, disk names, etc.).
   *
   * @returns Array of configured names.
   */
  getConfiguredNames(): string[] {
    return Object.keys(this.configs);
  }

  /**
   * Check whether a named configuration exists.
   *
   * @param name - The configuration name to check.
   * @returns `true` if a configuration with that name exists.
   */
  hasConfig(name: string): boolean {
    return name in this.configs;
  }

  /**
   * Get the current default name.
   *
   * @returns The default name used when none is specified.
   */
  getDefaultName(): string {
    return this.defaultName;
  }

  /**
   * Set the default name.
   *
   * @param name - The new default name.
   */
  setDefaultName(name: string): void {
    this.defaultName = name;
  }

  // ── Resolution ──────────────────────────────────────────

  /**
   * Resolve an adapter instance by name (lazy-creates and caches).
   *
   * Resolution flow:
   * 1. If already cached, return the cached instance.
   * 2. Look up the named config — fail fast if not configured.
   * 3. Look up the driver factory by `config.driver` — fail fast if not registered.
   * 4. Call the factory, cache the result, and return it.
   *
   * @param name - The named configuration to resolve. Defaults to {@link defaultName}.
   * @returns The adapter instance.
   * @throws {Error} If the name is not configured or the driver is not registered.
   *
   * @example
   * ```ts
   * const adapter = manager.resolve('postgres');
   * ```
   */
  protected resolve(name?: string): TAdapter {
    const resolvedName = name ?? this.defaultName;

    const cached = this.instances.get(resolvedName);
    if (cached) return cached;

    // Look up explicit config first; fall back to a registered driver whose name
    // matches the requested name (allows `registerDriver('x', f); resolve('x')`)
    let config = this.configs[resolvedName];
    if (!config) {
      if (this.drivers.has(resolvedName)) {
        config = { driver: resolvedName } as TConfig;
      } else {
        throw new Error(
          `${this.domainLabel} ${this.resolverLabel} "${resolvedName}" is not configured. ` +
            `Available: ${Object.keys(this.configs).join(", ") || "(none)"}. ` +
            `Check your config/${this.domainLabel.toLowerCase()} configuration.`,
        );
      }
    }

    const factory = this.drivers.get(config.driver);
    if (!factory) {
      throw new Error(
        `${this.domainLabel} driver "${config.driver}" is not registered. ` +
          `Available drivers: ${[...this.drivers.keys()].join(", ") || "(none)"}. ` +
          `Call manager.registerDriver('${config.driver}', factory) first.`,
      );
    }

    const adapter = factory(config);
    this.instances.set(resolvedName, adapter);
    return adapter;
  }

  // ── Lifecycle ───────────────────────────────────────────

  /**
   * Get a cached adapter instance without triggering resolution.
   *
   * Subclasses use this in overridden {@link purge} to perform cleanup (e.g. disconnect)
   * on the existing instance before it is removed from the cache.
   *
   * @param name - The name to look up. Defaults to the default name.
   * @returns The cached adapter, or `undefined` if not yet resolved.
   */
  protected getCached(name?: string): TAdapter | undefined {
    return this.instances.get(name ?? this.defaultName);
  }

  /**
   * Purge a cached adapter instance by name.
   *
   * Override this in subclasses to add cleanup logic (e.g. disconnecting a database).
   *
   * @param name - The name to purge. Defaults to the default name.
   */
  async purge(name?: string): Promise<void> {
    const resolvedName = name ?? this.defaultName;
    this.instances.delete(resolvedName);
  }

  /**
   * Purge all cached adapter instances.
   */
  async purgeAll(): Promise<void> {
    for (const name of this.instances.keys()) {
      await this.purge(name);
    }
  }
}
