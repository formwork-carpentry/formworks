/**
 * @module @formwork/tenancy
 * @description Multi-tenancy system — re-exports all public API.
 *
 * Use this package to:
 * - Resolve the active tenant per request (`TenancyManager.initialize()`)
 * - Run code inside a tenant context (`Tenancy.run()`)
 * - Manage isolation strategy (row vs. other strategies)
 *
 * @example
 * ```ts
 * import { TenancyManager, Tenancy } from '@formwork/tenancy';
 *
 * const tenancyManager = new TenancyManager(resolver, store, 'row');
 * Tenancy.setTenancyManager(tenancyManager);
 *
 * // In a request handler:
 * await Tenancy.initialize({ request: req });
 * await Tenancy.run(tenant, async () => {
 *   // all tenant-scoped operations happen here
 * });
 * ```
 *
 * @see TenancyManager — Tenant context initialization and scoping
 * @see Tenancy — Global facade for tenant context operations
 */

export * from './types.js';
export * from './resolvers.js';
export * from './store.js';
export * from './manager.js';
export * from './facades.js';
export * from './migrator.js';
export * from './scope.js';
