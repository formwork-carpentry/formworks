/**
 * @module @formwork/tenancy
 * @description Tenant resolvers — identify tenant from request context
 * @patterns Strategy (each resolver is a strategy), Chain of Responsibility (ChainResolver)
 */

import type { ITenantResolver, TenantResolverContext } from './types.js';

/**
 * Resolves tenant slug from hostname: `acme.localhost` → `acme` when `baseDomain` is `localhost`.
 *
 * @example
 * ```ts
 * import { SubdomainResolver } from '@formwork/tenancy';
 * const r = new SubdomainResolver('example.com');
 * await r.resolve({ hostname: 'tenant.example.com', path: '/', headers: {} });
 * ```
 *
 * @see ITenantResolver
 */
export class SubdomainResolver implements ITenantResolver {
  constructor(private baseDomain: string = 'localhost') {}

  /**
   * @param {TenantResolverContext} ctx
   * @returns {Promise<string | null>}
   */
  async resolve(ctx: TenantResolverContext): Promise<string | null> {
    if (!ctx.hostname) return null;
    const hostname = ctx.hostname.toLowerCase();
    if (hostname === this.baseDomain) return null;
    if (!hostname.endsWith(`.${this.baseDomain}`)) return null;

    const subdomain = hostname.slice(0, -(this.baseDomain.length + 1));
    return subdomain && subdomain !== 'www' ? subdomain : null;
  }
}

/**
 * Resolves tenant from URL path: `/tenant1/dashboard` → `tenant1` (optional path prefix).
 *
 * @example
 * ```ts
 * import { PathResolver } from '@formwork/tenancy';
 * const r = new PathResolver();
 * await r.resolve({ hostname: 'x', path: '/acme/posts', headers: {} });
 * ```
 *
 * @see ITenantResolver
 */
export class PathResolver implements ITenantResolver {
  constructor(private prefix: string = '') {}

  /**
   * @param {TenantResolverContext} ctx
   * @returns {Promise<string | null>}
   */
  async resolve(ctx: TenantResolverContext): Promise<string | null> {
    if (!ctx.path) return null;
    const path = ctx.path.replace(/^\//, '');
    const segments = path.split('/');
    const prefixSegments = this.prefix ? this.prefix.replace(/^\//, '').split('/') : [];

    // Skip prefix segments
    const tenantIndex = prefixSegments.length;
    return segments[tenantIndex] || null;
  }
}

/**
 * Resolves tenant from a header (default `x-tenant-id`).
 *
 * @example
 * ```ts
 * import { HeaderResolver } from '@formwork/tenancy';
 * const r = new HeaderResolver('x-tenant');
 * await r.resolve({ hostname: 'x', path: '/', headers: { 'x-tenant': 'acme' } });
 * ```
 *
 * @see ITenantResolver
 */
export class HeaderResolver implements ITenantResolver {
  constructor(private headerName: string = 'x-tenant-id') {}

  /**
   * @param {TenantResolverContext} ctx
   * @returns {Promise<string | null>}
   */
  async resolve(ctx: TenantResolverContext): Promise<string | null> {
    return ctx.headers?.[this.headerName.toLowerCase()] ?? null;
  }
}

/**
 * Maps custom hostnames to tenant slugs via `addMapping`.
 *
 * @example
 * ```ts
 * import { DomainResolver } from '@formwork/tenancy';
 * const r = new DomainResolver().addMapping('client.com', 'client');
 * await r.resolve({ hostname: 'client.com', path: '/', headers: {} });
 * ```
 *
 * @see ITenantResolver
 */
export class DomainResolver implements ITenantResolver {
  private domainMap = new Map<string, string>();

  /**
   * @param {string} domain
   * @param {string} tenantSlug
   * @returns {this}
   */
  addMapping(domain: string, tenantSlug: string): this {
    this.domainMap.set(domain.toLowerCase(), tenantSlug);
    return this;
  }

  /**
   * @param {TenantResolverContext} ctx
   * @returns {Promise<string | null>}
   */
  async resolve(ctx: TenantResolverContext): Promise<string | null> {
    if (!ctx.hostname) return null;
    return this.domainMap.get(ctx.hostname.toLowerCase()) ?? null;
  }
}

/**
 * Tries each resolver in order; returns the first non-null slug.
 *
 * @example
 * ```ts
 * import { ChainResolver, HeaderResolver, SubdomainResolver } from '@formwork/tenancy';
 * const r = new ChainResolver([new HeaderResolver(), new SubdomainResolver('app.test')]);
 * ```
 *
 * @see ITenantResolver
 */
export class ChainResolver implements ITenantResolver {
  constructor(private resolvers: ITenantResolver[]) {}

  /**
   * @param {TenantResolverContext} ctx
   * @returns {Promise<string | null>}
   */
  async resolve(ctx: TenantResolverContext): Promise<string | null> {
    for (const resolver of this.resolvers) {
      const result = await resolver.resolve(ctx);
      if (result !== null) return result;
    }
    return null;
  }
}

// ── Tenant Store — retrieves tenant data ──────────────────
