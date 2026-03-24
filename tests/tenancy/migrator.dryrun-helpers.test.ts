import { describe, expect, it } from 'vitest';

import {
  InMemoryTenantExporter,
  InMemoryTenantImporter,
  TenantMigrator,
} from '../../src/tenancy/migrator.js';
import { InMemoryTenantStore } from '../../src/tenancy/store.js';
import type { Tenant } from '../../src/tenancy/types.js';

function tenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'acme',
    slug: 'acme',
    name: 'Acme',
    status: 'active',
    config: { isolation: 'row' },
    ...overrides,
  };
}

describe('tenancy/migrator dry-run and helpers', () => {
  it('supports dryRun and computes table/row estimates', async () => {
    const exporter = new InMemoryTenantExporter();
    exporter.seed('acme', {
      users: [{ id: 1 }, { id: 2 }],
      posts: [{ id: 10 }],
    });

    const migrator = new TenantMigrator(exporter, new InMemoryTenantImporter(), new InMemoryTenantStore());
    const result = await migrator.dryRun(tenant(), 'row', 'database');

    expect(result.tenantId).toBe('acme');
    expect(result.tables).toBe(2);
    expect(result.rows).toBe(3);
    expect(result.estimatedBytes).toBeGreaterThan(0);
  });

  it('in-memory importer/exporter assertion helpers work', async () => {
    const exporter = new InMemoryTenantExporter();
    const importer = new InMemoryTenantImporter();

    exporter.seed('acme', { users: [{ id: 1 }] });
    const snapshot = await exporter.export(tenant());

    await importer.import(tenant(), snapshot, 'row');
    expect(importer.getImported()).toHaveLength(1);
    expect(() => importer.assertImported('acme')).not.toThrow();
    expect(() => importer.assertImportedTo('acme', 'row')).not.toThrow();

    importer.reset();
    expect(importer.getImported()).toEqual([]);
  });
});
