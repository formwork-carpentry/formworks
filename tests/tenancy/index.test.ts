import { describe, expect, it } from 'vitest';

import * as tenancy from '../../src/tenancy/index.js';

describe('tenancy/index', () => {
  it('re-exports key tenancy surface area', () => {
    expect(typeof tenancy.TenancyManager).toBe('function');
    expect(typeof tenancy.TenantMigrator).toBe('function');
    expect(typeof tenancy.InMemoryTenantStore).toBe('function');
    expect(typeof tenancy.SubdomainResolver).toBe('function');
    expect(typeof tenancy.TenantScope).toBe('function');
    expect(typeof tenancy.Tenancy).toBe('object');
    expect(typeof tenancy.setTenancyManager).toBe('function');
  });
});
