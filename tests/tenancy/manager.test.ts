import { describe, expect, it } from 'vitest';

import { TenancyManager } from '../../src/tenancy/manager.js';
import type { ITenantResolver, Tenant, TenantResolverContext } from '../../src/tenancy/types.js';
import { InMemoryTenantStore } from '../../src/tenancy/store.js';

class StaticTenantResolver implements ITenantResolver {
  constructor(private readonly slug: string | null) {}

  async resolve(_context: TenantResolverContext): Promise<string | null> {
    return this.slug;
  }
}

function buildTenant(slug: string): Tenant {
  return {
    id: slug,
    slug,
    name: slug.toUpperCase(),
    status: 'active',
    config: {},
    createdAt: new Date(),
  };
}

describe('TenancyManager', () => {
  it('initializes tenant from resolver and store', async () => {
    // Arrange
    const store = new InMemoryTenantStore();
    await store.create({ id: 'acme', slug: 'acme', name: 'Acme', status: 'active', config: {} });
    const manager = new TenancyManager(new StaticTenantResolver('acme'), store, 'row');

    // Act
    const tenant = await manager.initialize({});

    // Assert
    expect(tenant?.slug).toBe('acme');
    expect(manager.hasTenant()).toBe(true);
    expect(manager.tenant().slug).toBe('acme');
  });

  it('runs callback in scoped tenant and restores previous context', async () => {
    // Arrange
    const store = new InMemoryTenantStore();
    const manager = new TenancyManager(new StaticTenantResolver(null), store);
    const first = buildTenant('alpha');
    const second = buildTenant('beta');
    manager.setTenant(first);

    // Act
    const result = await manager.run(second, async () => manager.tenant().slug);

    // Assert
    expect(result).toBe('beta');
    expect(manager.tenant().slug).toBe('alpha');
  });

  it('emits switched and ended events', async () => {
    // Arrange
    const store = new InMemoryTenantStore();
    const manager = new TenancyManager(new StaticTenantResolver(null), store);
    const calls: Array<{ event: 'switched' | 'ended'; tenant: Tenant | null }> = [];
    manager.on((event, tenant) => calls.push({ event, tenant }));

    // Act
    manager.setTenant(buildTenant('acme'));
    manager.end();

    // Assert
    expect(calls[0]?.event).toBe('switched');
    expect(calls[0]?.tenant?.slug).toBe('acme');
    expect(calls[1]?.event).toBe('ended');
    expect(calls[1]?.tenant?.slug).toBe('acme');
  });
});
