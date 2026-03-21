/**
 * @module @formwork/tenancy
 * @description Core types and interfaces
 */

/**
 * @module @formwork/tenancy
 * @description Tenancy — tenant resolution, isolation strategies, scoped operations
 *
 * Architecture:
 *   TenantResolver identifies which tenant a request belongs to (subdomain, header, path, domain)
 *   IsolationStrategy determines how data is separated (database, schema, row-level)
 *   TenancyManager holds the current tenant context and scopes operations
 *
 * @patterns Strategy (resolvers, isolation), Context (current tenant), Proxy (scoped operations)
 * @principles OCP — new resolvers/strategies without modifying core
 *             DIP — depends on interfaces; SRP — resolution, isolation, and management are separate
 */

// ── Core Types ────────────────────────────────────────────

export interface Tenant {
  id: string | number;
  name: string;
  slug: string;
  domain?: string;
  config?: Record<string, unknown>;
  status: TenantStatus;
  createdAt?: Date;
}

export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type IsolationStrategy = 'database' | 'schema' | 'row';

// ── Tenant Resolver — identifies tenant from request ──────

export interface ITenantResolver {
  /** Resolve tenant ID/slug from a request-like context */
  /**
   * @param {TenantResolverContext} context
   * @returns {Promise<string | null>}
   */
  resolve(context: TenantResolverContext): Promise<string | null>;
}

export interface TenantResolverContext {
  hostname?: string;
  path?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}
