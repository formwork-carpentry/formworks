import { describe, expect, it, vi } from 'vitest';

import { InMemoryTenantStore } from '../../src/tenancy/store.js';
import { TenancyManager } from '../../src/tenancy/manager.js';
import type { ITenantResolver, TenantResolverContext } from '../../src/tenancy/types.js';

class StaticResolver implements ITenantResolver {
  constructor(private readonly slug: string | null) {}

  async resolve(_context: TenantResolverContext): Promise<string | null> {
    return this.slug;
  }
}

describe('tenancy/facades', () => {
  it('throws when manager is not initialized', async () => {
    vi.resetModules();
    const facades = await import('../../src/tenancy/facades.js');

    expect(() => facades.Tenancy.getTenant()).toThrow('TenancyManager not initialized.');
  });

  it('delegates operations to configured manager', async () => {
    vi.resetModules();
    const facades = await import('../../src/tenancy/facades.js');

    const store = new InMemoryTenantStore();
    await store.create({ id: 'acme', slug: 'acme', name: 'Acme', status: 'active', config: {} });
    const manager = new TenancyManager(new StaticResolver('acme'), store);

    facades.setTenancyManager(manager);

    const initialized = await facades.Tenancy.initialize({});
    expect(initialized?.slug).toBe('acme');
    expect(facades.Tenancy.hasTenant()).toBe(true);

    const result = await facades.Tenancy.run(initialized!, async () => facades.Tenancy.tenant().slug);
    expect(result).toBe('acme');

    facades.Tenancy.end();
    expect(facades.Tenancy.hasTenant()).toBe(false);
  });
});
