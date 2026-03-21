/**
 * @module @formwork/foundation
 * @description InfrastructureServiceProvider — reads config and wires all infrastructure
 * managers (DB, cache, queue, mail, storage, bridge, logger, events, validator) into the container.
 * Lives in foundation, NOT core, to keep core lean and dependency-free.
 *
 * Each domain uses the Domain Factory Manager pattern:
 *   Config → Manager → registerDriver(name, factory) → lazy resolve
 *
 * External adapters (postgres, redis, bullmq, smtp, s3, grpc, kafka, nats, etc.)
 * are registered via their `DriverFactory` exports. Built-in adapters (memory, sqlite,
 * sync, log, etc.) ship with each manager.
 *
 * @patterns Abstract Factory (config→manager→adapter), Mediator (config↔container)
 * @principles DIP (binds by interface), SRP (wiring only), OCP (new adapters via new packages),
 *             DRY (shared BaseManager), Convention over Configuration
 */

import { ServiceProvider, type IContainer } from '@formwork/core/container';
import { Config, ConfigResolver, buildDefaultConfig } from '@formwork/core/config';
import {
  DatabaseInfrastructureProvider,
  CacheInfrastructureProvider,
  QueueInfrastructureProvider,
  MailInfrastructureProvider,
  StorageInfrastructureProvider,
  BridgeInfrastructureProvider,
  CoreInfrastructureProvider,
} from './providers/index.js';

/**
 * The master service provider for a Carpenter application.
 *
 * Reads `config` from the container (or builds defaults) and registers:
 * - `config`, `config.resolver`
 * - `db`, `db.manager`
 * - `cache`, `cache.manager`
 * - `queue`, `queue.manager`
 * - `mail`, `mail.manager`
 * - `storage`, `storage.manager`
 * - `bridge`, `bridge.manager`
 * - `logger`
 * - `events`
 * - `validator`
 *
 * @example
 * ```ts
 * import { Application } from '@formwork/core';
 * import { InfrastructureServiceProvider } from '@formwork/foundation';
 *
 * const app = await Application.create({
 *   providers: [InfrastructureServiceProvider],
 * });
 *
 * const db = app.make('db');       // default database adapter
 * const cache = app.make('cache'); // default cache store
 * ```
 */
export class InfrastructureServiceProvider extends ServiceProvider {
  /**
   * Register all infrastructure bindings into the container.
   * @returns {void}
   */
  register(): void {
    const config = this.resolveConfig();
    const resolver = new ConfigResolver(config);

    this.app.instance('config', config);
    this.app.instance('config.resolver', resolver);

    new DatabaseInfrastructureProvider(this.app, resolver).register();
    new CacheInfrastructureProvider(this.app, resolver).register();
    new QueueInfrastructureProvider(this.app, resolver).register();
    new MailInfrastructureProvider(this.app, resolver).register();
    new StorageInfrastructureProvider(this.app, resolver).register();
    new BridgeInfrastructureProvider(this.app, resolver).register();
    new CoreInfrastructureProvider(this.app, resolver).register();
  }

  boot(): void {
    // Managers are lazy — adapters created on first access
  }

  private resolveConfig(): Config {
    try {
      return this.app.make<Config>('config');
    } catch {
      return new Config(buildDefaultConfig());
    }
  }
}
