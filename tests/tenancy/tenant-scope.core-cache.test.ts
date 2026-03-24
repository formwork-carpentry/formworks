import { describe, it, expect, beforeEach } from 'vitest';
import { TenantScope, TenantCacheScope } from '../../src/tenancy/scope.js';
import type { Tenant } from '../../src/tenancy/types.js';

class InMemoryCacheDouble {
  private readonly data = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.data.get(key) as T | undefined) ?? null;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async forget(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }
}

describe('tenancy/TenantScope core and cache scope', () => {
  const tenant: Tenant = {
    id: 'acme',
    name: 'Acme Corp',
    slug: 'acme',
    domain: 'acme.example.com',
    status: 'active' as const,
  };

  it('applies tenant where clause and exposes metadata', () => {
    const scope = new TenantScope(tenant, 'tenant_id');
    const fakeQb = {
      clauses: [] as Array<{ col: string; val: unknown }>,
      where(col: string, val: unknown) {
        this.clauses.push({ col, val });
        return this;
      },
    };

    scope.apply(fakeQb);
    expect(fakeQb.clauses).toEqual([{ col: 'tenant_id', val: 'acme' }]);
    expect(scope.getColumn()).toBe('tenant_id');
    expect(scope.getTenantId()).toBe('acme');

    const custom = new TenantScope(tenant, 'org_id');
    expect(custom.getColumn()).toBe('org_id');
  });

  describe('TenantCacheScope', () => {
    let innerStore: InMemoryCacheDouble;

    beforeEach(() => {
      innerStore = new InMemoryCacheDouble();
    });

    it('prefixes keys and isolates tenants', async () => {
      const scopeA = new TenantCacheScope(innerStore, tenant);
      const tenant2: Tenant = { id: 'beta', name: 'Beta Inc', slug: 'beta', domain: '', status: 'active' as const };
      const scopeB = new TenantCacheScope(innerStore, tenant2);

      await scopeA.put('data', 'acme-data');
      await scopeB.put('data', 'beta-data');

      expect(await innerStore.get('tenant_acme:data')).toBe('acme-data');
      expect(await scopeA.get('data')).toBe('acme-data');
      expect(await scopeB.get('data')).toBe('beta-data');
      expect(scopeA.getPrefix()).toBe('tenant_acme:');
    });

    it('supports forget and has against prefixed keys', async () => {
      const scoped = new TenantCacheScope(innerStore, tenant);
      await scoped.put('temp', 'value');
      expect(await scoped.has('temp')).toBe(true);

      await scoped.forget('temp');
      expect(await scoped.has('temp')).toBe(false);
      expect(await innerStore.get('tenant_acme:temp')).toBeNull();
    });
  });
});
