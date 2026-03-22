/**
 * @module @formwork/core/contracts/tenancy
 * @description Multi-tenancy contracts - tenant resolution, store, and scoping.
 *
 * Implementations: SubdomainResolver, PathResolver, HeaderResolver, TenancyManager,
 *                  InMemoryTenantStore, TenantScope, TenantCacheScope, TenantStorageScope
 *
 * @example
 * ```ts
 * const resolver = new SubdomainResolver('myapp.com');
 * const tenant = await resolver.resolve(request);
 * const scopedCache = new TenantCacheScope(cache, tenant);
 * await scopedCache.put('key', value); // stored as 'tenant_acme:key'
 * ```
 */
export {};
//# sourceMappingURL=index.js.map