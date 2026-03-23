/**
 * @module @carpentry/foundation
 * @description Application foundation — bootstrapping, service provider wiring, and config-driven infrastructure.
 *
 * This package is the primary entry point for wiring up a full Carpenter application.
 * It connects {@link module:@carpentry/core} to infrastructure packages like DB, cache, queue, mail, storage, etc.
 *
 * @example
 * ```ts
 * import { bootstrap } from '@carpentry/foundation';
 *
 * const { container, config } = await bootstrap({
 *   skipEnv: true,
 *   configOverrides: { app: { name: 'MyApp' } },
 * });
 *
 * const queue = container.make('queue');
 * const cache = container.make('cache');
 * ```
 *
 * @see bootstrap — One-call app bootstrapper
 * @see InfrastructureServiceProvider — Default infrastructure wiring wrapper
 */

export { InfrastructureServiceProvider } from './InfrastructureServiceProvider.js';
export * from './providers/index.js';
export { bootstrap } from './Bootstrap.js';
export type { BootstrapOptions } from './Bootstrap.js';
