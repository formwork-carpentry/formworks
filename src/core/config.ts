/**
 * @module @carpentry/core/config
 * @description Configuration management — typed config repository, env loaders, and config resolver.
 *
 * @example
 * ```ts
 * import { Config, loadEnv, env, envRequired } from './config';
 *
 * await loadEnv({ path: '.env' });
 * const appName = env('APP_NAME', 'Default');
 * const port = Number(envRequired('PORT'));
 *
 * const config = new Config({ app: { port, name: appName } });
 * const p = config.get('app.port');
 * ```
 */

export { Config, env } from "./config/Config.js";
export type { ConfigRepository } from "./config/Config.js";
export { loadEnv, parseEnvString, envRequired } from "./config/EnvLoader.js";
export type { EnvLoaderOptions } from "./config/EnvLoader.js";
export { ConfigResolver } from "./config/ConfigResolver.js";
export { buildDefaultConfig } from "./config/defaults.js";
