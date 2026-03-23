/**
 * @module @carpentry/tenancy
 * @description Tenant store — retrieves and manages tenant data
 * @patterns Repository
 */

import type { Tenant } from './types.js';

export interface ITenantStore {
  /**
   * @param {string} slug
   * @returns {Promise<Tenant | null>}
   */
  findBySlug(slug: string): Promise<Tenant | null>;
  /**
   * @param {string | number} id
   * @returns {Promise<Tenant | null>}
   */
  findById(id: string | number): Promise<Tenant | null>;
  all(): Promise<Tenant[]>;
  /**
   * @param {Omit<Tenant, 'createdAt'>} data
   * @returns {Promise<Tenant>}
   */
  create(data: Omit<Tenant, 'createdAt'>): Promise<Tenant>;
  /**
   * @param {string | number} id
   * @param {Partial<Tenant>} data
   * @returns {Promise<Tenant | null>}
   */
  update(id: string | number, data: Partial<Tenant>): Promise<Tenant | null>;
  /**
   * @param {string | number} id
   * @returns {Promise<boolean>}
   */
  delete(id: string | number): Promise<boolean>;
}

/**
 * In-memory {@link ITenantStore} for tests and prototypes — keeps tenants in an array.
 *
 * @example
 * ```ts
 * import { InMemoryTenantStore } from './';
 *
 * const store = new InMemoryTenantStore();
 * await store.create({ id: '1', slug: 'acme', name: 'Acme', status: 'active', config: {} });
 * ```
 *
 * @see ITenantStore
 */
export class InMemoryTenantStore implements ITenantStore {
  private tenants: Tenant[] = [];

  /**
   * @param {string} slug
   * @returns {Promise<Tenant | null>}
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenants.find((t) => t.slug === slug) ?? null;
  }

  /**
   * @param {string | number} id
   * @returns {Promise<Tenant | null>}
   */
  async findById(id: string | number): Promise<Tenant | null> {
    return this.tenants.find((t) => t.id === id) ?? null;
  }

  async all(): Promise<Tenant[]> { return [...this.tenants]; }

  /**
   * @param {Omit<Tenant, 'createdAt'>} data
   * @returns {Promise<Tenant>}
   */
  async create(data: Omit<Tenant, 'createdAt'>): Promise<Tenant> {
    const tenant: Tenant = { ...data, createdAt: new Date() };
    this.tenants.push(tenant);
    return tenant;
  }

  /**
   * @param {string | number} id
   * @param {Partial<Tenant>} data
   * @returns {Promise<Tenant | null>}
   */
  async update(id: string | number, data: Partial<Tenant>): Promise<Tenant | null> {
    const tenant = this.tenants.find((t) => t.id === id);
    if (!tenant) return null;
    Object.assign(tenant, data);
    return tenant;
  }

  /**
   * @param {string | number} id
   * @returns {Promise<boolean>}
   */
  async delete(id: string | number): Promise<boolean> {
    const idx = this.tenants.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    this.tenants.splice(idx, 1);
    return true;
  }

  reset(): void { this.tenants = []; }
}

// ── TenancyManager — holds current tenant context ─────────

export type TenancyEventHandler = (event: 'switched' | 'ended', tenant: Tenant | null) => void;
