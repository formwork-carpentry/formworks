/**
 * @module @carpentry/foundation
 * @description Bootstrap — one-call application bootstrapper.
 * Loads .env, builds config, registers the InfrastructureServiceProvider,
 * and returns a fully wired container.
 * @patterns Facade (simplified bootstrap API), Template Method (lifecycle steps)
 * @principles Convention over Configuration, DIP
 */

import type { ServiceProvider } from "../contracts";
import { Config } from "../core/config";
import { loadEnv } from "../core/config";
import { buildDefaultConfig } from "../core/config";
import { Container } from "../core/container";
import { InfrastructureServiceProvider } from "./InfrastructureServiceProvider.js";

import type { IContainer } from "../core/container";
import type { Dictionary } from "../core/types";

export interface BootstrapOptions {
  /** Path to .env file (default: process.cwd() + '/.env') */
  envPath?: string;
  /** Extra .env files to load (e.g., '.env.local', '.env.test') */
  envFiles?: string[];
  /** Override for the config object (skips buildDefaultConfig) */
  config?: Dictionary;
  /** Additional config to merge on top of defaults */
  configOverrides?: Dictionary;
  /** Additional service providers to register after infrastructure */
  providers?: Array<new (app: IContainer) => ServiceProvider>;
  /** Skip loading .env file (e.g., in testing) */
  skipEnv?: boolean;
}

/**
 * Bootstrap a fully configured Carpenter application in one call.
 *
 * @example
 * ```ts
 * // Minimal — loads .env, builds config, wires everything
 * const { container, config } = await bootstrap();
 * const db = container.make('db');
 *
 * // With overrides
 * const { container } = await bootstrap({
 *   configOverrides: { database: { default: 'postgres' } },
 *   providers: [MyAppServiceProvider],
 * });
 *
 * // For testing (skip .env)
 * const { container } = await bootstrap({ skipEnv: true });
 * ```
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<{
  container: Container;
  config: Config;
}> {
  // 1. Load environment variables
  /**
   * @param {unknown} !options.skipEnv
   */
  if (!options.skipEnv) {
    const envOptions: { path?: string; extraFiles?: string[] } = {};
    if (options.envPath !== undefined) {
      envOptions.path = options.envPath;
    }
    if (options.envFiles !== undefined) {
      envOptions.extraFiles = options.envFiles;
    }
    await loadEnv(envOptions);
  }

  // 2. Build config
  const configData = options.config ?? buildDefaultConfig();
  const config = new Config(configData);
  /**
   * @param {unknown} options.configOverrides
   */
  if (options.configOverrides) {
    config.merge(options.configOverrides);
  }

  // 3. Create container and bind config
  const container = new Container();
  container.instance("config", config);

  // 4. Register infrastructure
  const infraProvider = new InfrastructureServiceProvider(container);
  infraProvider.register();
  infraProvider.boot();

  // 5. Wire ORM adapter so BaseModel.create/query/find work
  try {
    const { BaseModel } = await import("../orm");
    BaseModel.adapter = container.make("db");
  } catch {
    // ORM package may not be installed — skip silently
  }

  // 6. Register additional providers
  /**
   * @param {unknown} options.providers
   */
  if (options.providers) {
    for (const ProviderClass of options.providers) {
      const provider = new ProviderClass(container);
      provider.register();
      provider.boot();
    }
  }

  return { container, config };
}
