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

/** @typedef {Object} Tenant - A tenant record */
export interface Tenant {
  /** @property {string} id - Unique tenant identifier */
  id: string;
  /** @property {string} name - Display name */
  name: string;
  /** @property {string} slug - URL-friendly slug */
  slug: string;
  /** @property {string} [domain] - Custom domain */
  domain?: string;
  /** @property {string} status - 'active' | 'suspended' | 'pending' */
  status: string;
}

/** @typedef {Object} ITenantResolver - Resolves the current tenant from a request */
export interface ITenantResolver {
  /**
   * Resolve the current tenant from request context.
   * @param {Object} request - HTTP request (headers, hostname, path)
   * @returns {Promise<Tenant | null>} Resolved tenant or null
   */
  resolve(request: {
    hostname: string;
    path: string;
    headers: Record<string, string>;
  }): Promise<Tenant | null>;
}

/** @typedef {Object} ITenantStore - Persists and retrieves tenant data */
export interface ITenantStore {
  /**
   * Find a tenant by ID.
   * @param {string} id - Tenant ID
   * @returns {Promise<Tenant | null>}
   */
  findById(id: string): Promise<Tenant | null>;

  /**
   * Find a tenant by slug.
   * @param {string} slug - Tenant slug
   * @returns {Promise<Tenant | null>}
   */
  findBySlug(slug: string): Promise<Tenant | null>;

  /**
   * List all tenants.
   * @returns {Promise<Tenant[]>}
   */
  all(): Promise<Tenant[]>;

  /**
   * Create a new tenant.
   * @param {Omit<Tenant, 'createdAt'>} data - Tenant data
   * @returns {Promise<Tenant>} Created tenant
   */
  create(data: Omit<Tenant, "createdAt">): Promise<Tenant>;
}
