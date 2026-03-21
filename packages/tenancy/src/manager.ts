/**
 * @module @formwork/tenancy
 * @description TenancyManager — holds current tenant context, scoped execution
 * @patterns Mediator, Observer (events)
 * @principles SRP (tenant context management only)
 */

import type {
  IsolationStrategy,
  ITenantResolver,
  Tenant,
  TenantResolverContext,
} from './types.js';
import type { ITenantStore, TenancyEventHandler } from './store.js';

/**
 * TenancyManager holds the current tenant and provides scoped execution helpers.
 *
 * Typical usage:
 * - Call {@link initialize} once per request to resolve the tenant.
 * - Call {@link run} or {@link tenant}/{@link getTenant} to scope application work.
 *
 * @example
 * ```ts
 * import { TenancyManager, Tenancy } from '@formwork/tenancy';
 *
 * const manager = new TenancyManager(resolver, store, 'row');
 * Tenancy.setTenancyManager(manager);
 *
 * // Example request context:
 * await Tenancy.initialize({ request: req });
 *
 * const tenant = Tenancy.tenant();
 * await Tenancy.run(tenant, async () => {
 *   // Do tenant-scoped work here
 * });
 * ```
 *
 * @see ITenantResolver — Resolve tenant identifiers from a request
 * @see ITenantStore — Load/validate tenant records
 */
export class TenancyManager {
  private currentTenant: Tenant | null = null;
  private resolver: ITenantResolver;
  private store: ITenantStore;
  private isolation: IsolationStrategy;
  private handlers: TenancyEventHandler[] = [];

  constructor(
    resolver: ITenantResolver,
    store: ITenantStore,
    isolation: IsolationStrategy = 'row',
  ) {
    this.resolver = resolver;
    this.store = store;
    this.isolation = isolation;
  }

  /** Resolve and initialize tenant from a request context */
  /**
   * @param {TenantResolverContext} context
   * @returns {Promise<Tenant | null>}
   */
  async initialize(context: TenantResolverContext): Promise<Tenant | null> {
    const slug = await this.resolver.resolve(context);
    if (!slug) {
      this.currentTenant = null;
      return null;
    }

    const tenant = await this.store.findBySlug(slug);
    if (!tenant || tenant.status !== 'active') {
      this.currentTenant = null;
      return null;
    }

    return this.setTenant(tenant);
  }

  /** Manually switch to a tenant (for CLI, jobs, testing) */
  /**
   * @param {Tenant} tenant
   * @returns {Tenant}
   */
  setTenant(tenant: Tenant): Tenant {
    this.currentTenant = tenant;
    this.emit('switched', tenant);
    return tenant;
  }

  /** Get the current tenant (throws if none) */
  tenant(): Tenant {
    if (!this.currentTenant) {
      throw new Error('No tenant initialized. Call initialize() or setTenant() first.');
    }
    return this.currentTenant;
  }

  /** Get the current tenant or null */
  getTenant(): Tenant | null {
    return this.currentTenant;
  }

  /** Check if a tenant is active */
  hasTenant(): boolean {
    return this.currentTenant !== null;
  }

  /** End the current tenancy context */
  end(): void {
    const prev = this.currentTenant;
    this.currentTenant = null;
    this.emit('ended', prev);
  }

  /** Run a callback in the context of a specific tenant */
  /**
   * @param {Tenant} tenant
   * @param {(} fn
   * @returns {Promise<T>}
   */
  async run<T>(tenant: Tenant, fn: () => Promise<T>): Promise<T> {
    const previous = this.currentTenant;
    this.setTenant(tenant);
    try {
      return await fn();
    } finally {
      if (previous) this.setTenant(previous);
      else this.end();
    }
  }

  /** Get isolation strategy */
  getIsolation(): IsolationStrategy { return this.isolation; }

  /** Get the tenant store */
  getStore(): ITenantStore { return this.store; }

  /** Register event handler */
  /**
   * @param {TenancyEventHandler} handler
   */
  on(handler: TenancyEventHandler): void { this.handlers.push(handler); }

  private emit(event: 'switched' | 'ended', tenant: Tenant | null): void {
    for (const h of this.handlers) h(event, tenant);
  }
}

// ── Facade ────────────────────────────────────────────────
