/**
 * @module @carpentry/db
 * @description DatabaseManager — resolves database adapters by connection name from config.
 * Extends {@link CarpenterFactoryBase} for shared driver registration, lazy resolution, and instance caching.
 *
 * @patterns Abstract Factory (creates adapters by driver name), Strategy (driver swapping)
 * @principles DIP — app code uses IDatabaseAdapter, never a concrete driver
 *             OCP — new drivers via registerDriver()
 *             DRY — shared resolution logic via BaseManager
 */

import { CarpenterFactoryBase, type CarpenterFactoryAdapter } from '@carpentry/formworks/adapters';
import type { IDatabaseAdapter } from '@carpentry/formworks/contracts';

export interface DatabaseConnectionConfig {
  /** Driver name: 'sqlite', 'postgres', 'mysql', 'mongodb', 'memory' */
  driver: string;
  /** Connection-specific options passed to the driver factory */
  [key: string]: unknown;
}

export type DatabaseDriverFactory = CarpenterFactoryAdapter<DatabaseConnectionConfig, IDatabaseAdapter>;

/**
 * DatabaseManager — resolves database connections from configuration.
 *
 * @example
 * ```ts
 * const manager = new DatabaseManager('sqlite', {
 *   sqlite: { driver: 'sqlite', database: ':memory:' },
 *   postgres: { driver: 'postgres', host: 'localhost', port: 5432, database: 'app' },
 * });
 *
 * manager.registerDriver('sqlite', (cfg) => new SqliteAdapter(cfg));
 * manager.registerDriver('postgres', (cfg) => new PostgresAdapter(cfg));
 *
 * const db = manager.connection(); // default connection
 * const pg = manager.connection('postgres'); // named connection
 * ```
 *
 * @see CarpenterFactoryBase — shared driver registration and resolution
 */
export class DatabaseManager extends CarpenterFactoryBase<IDatabaseAdapter, DatabaseConnectionConfig> {
  protected readonly resolverLabel = 'connection';
  protected readonly domainLabel = 'Database';

  constructor(
    defaultConnection: string = 'memory',
    configs: Record<string, DatabaseConnectionConfig> = {},
  ) {
    super(defaultConnection, configs);
  }

  /**
   * Get a database connection by name.
   * Connections are cached (singleton per name).
   *
   * @param name - Connection name. Defaults to the configured default.
   * @returns The resolved database adapter.
   * @throws {Error} If the connection is not configured or the driver is not registered.
   */
  connection(name?: string): IDatabaseAdapter {
    return this.resolve(name);
  }

  /** Get the default connection name */
  getDefaultConnection(): string {
    return this.getDefaultName();
  }

  /** Set the default connection name */
  setDefaultConnection(name: string): void {
    this.setDefaultName(name);
  }

  /** Check if a connection config exists */
  hasConnection(name: string): boolean {
    return this.hasConfig(name);
  }

  /** Get all configured connection names */
  getConnectionNames(): string[] {
    return this.getConfiguredNames();
  }

  /** Disconnect a named connection */
  async disconnect(name?: string): Promise<void> {
    await this.purge(name);
  }

  /** Disconnect all connections */
  async disconnectAll(): Promise<void> {
    await this.purgeAll();
  }

  /**
   * Override purge to disconnect the adapter before removing it from the cache.
   */
  override async purge(name?: string): Promise<void> {
    const adapter = this.getCached(name);
    if (adapter) {
      try {
        await adapter.disconnect();
      } catch {
        // Adapter may already be disconnected or broken — ignore
      }
    }
    await super.purge(name);
  }
}