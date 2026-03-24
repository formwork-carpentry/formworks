import { describe, expect, it } from 'vitest';

import type { ITenantResolver, Tenant, TenantResolverContext } from '../../src/tenancy/types.js';

class ResolverDouble implements ITenantResolver {
  async resolve(context: TenantResolverContext): Promise<string | null> {
    return context.hostname ? 'tenant-a' : null;
  }
}

describe('tenancy/types', () => {
  it('supports expected tenant and resolver contracts', async () => {
    const sample: Tenant = {
      id: 'a',
      name: 'Tenant A',
      slug: 'tenant-a',
      status: 'active',
      config: {},
    };

    const resolver: ITenantResolver = new ResolverDouble();
    const resolved = await resolver.resolve({ hostname: 'tenant-a.localhost', headers: {} });

    expect(sample.slug).toBe('tenant-a');
    expect(resolved).toBe('tenant-a');
  });
});
