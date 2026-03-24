import { describe, expect, it } from 'vitest';

import { InMemoryTenantStore } from '../../src/tenancy/store.js';

describe('InMemoryTenantStore', () => {
  it('creates and finds tenants by slug and id', async () => {
    // Arrange
    const store = new InMemoryTenantStore();

    // Act
    await store.create({
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme',
      status: 'active',
      config: { timezone: 'UTC' },
    });

    // Assert
    expect((await store.findBySlug('acme'))?.id).toBe('tenant-1');
    expect((await store.findById('tenant-1'))?.slug).toBe('acme');
  });

  it('updates and deletes tenants', async () => {
    // Arrange
    const store = new InMemoryTenantStore();
    await store.create({
      id: 'tenant-2',
      slug: 'globex',
      name: 'Globex',
      status: 'active',
      config: {},
    });

    // Act
    const updated = await store.update('tenant-2', { status: 'inactive' });
    const deleted = await store.delete('tenant-2');

    // Assert
    expect(updated?.status).toBe('inactive');
    expect(deleted).toBe(true);
    expect(await store.findById('tenant-2')).toBeNull();
  });
});
