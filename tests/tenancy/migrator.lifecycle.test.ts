import { describe, expect, it } from 'vitest';

import {
  InMemoryTenantExporter,
  InMemoryTenantImporter,
  TenantMigrator,
} from '../../src/tenancy/migrator.js';
import { InMemoryTenantStore } from '../../src/tenancy/store.js';
import type { IsolationStrategy, Tenant } from '../../src/tenancy/types.js';

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

class SwitchingExporter extends InMemoryTenantExporter {
  override async export(currentTenant: Tenant) {
    if (currentTenant.config?.['isolation'] === 'database') {
      return {
        tenantId: currentTenant.id,
        exportedAt: new Date(),
        sourceStrategy: 'database' as IsolationStrategy,
        tables: { users: [{ id: 1 }] },
      };
    }

    return {
      tenantId: currentTenant.id,
      exportedAt: new Date(),
      sourceStrategy: 'row' as IsolationStrategy,
      tables: { users: [{ id: 1 }, { id: 2 }] },
    };
  }
}

describe('tenancy/migrator lifecycle', () => {
  it('migrates successfully and switches tenant isolation config', async () => {
    const exporter = new InMemoryTenantExporter();
    exporter.seed('acme', {
      users: [{ id: 1 }, { id: 2 }],
      posts: [{ id: 10 }],
    });
    const importer = new InMemoryTenantImporter();
    const store = new InMemoryTenantStore();
    await store.create({ id: 'acme', slug: 'acme', name: 'Acme', status: 'active', config: { isolation: 'row' } });

    const migrator = new TenantMigrator(exporter, importer, store);
    const phases: string[] = [];
    migrator.onProgress((p) => phases.push(p.phase));

    const result = await migrator.migrate(tenant(), 'row', 'database');

    expect(result.success).toBe(true);
    importer.assertImportedTo('acme', 'database');

    const updated = await store.findById('acme');
    expect(updated?.config?.['isolation']).toBe('database');
    expect(phases).toEqual(['exporting', 'validating', 'importing', 'verifying', 'switching', 'complete']);
  });

  it('returns rolled-back when verification fails', async () => {
    const exporter = new SwitchingExporter();
    const importer = new InMemoryTenantImporter();
    const store = new InMemoryTenantStore();

    const migrator = new TenantMigrator(exporter, importer, store);
    const phases: string[] = [];
    migrator.onProgress((p) => phases.push(p.phase));

    const result = await migrator.migrate(tenant(), 'row', 'database');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Verification failed');
    expect(phases.at(-1)).toBe('rolled-back');
  });

  it('returns failed when exporter throws', async () => {
    const failingExporter = {
      export: async () => {
        throw new Error('export failed');
      },
    };
    const importer = new InMemoryTenantImporter();
    const store = new InMemoryTenantStore();

    const migrator = new TenantMigrator(failingExporter, importer, store);
    const result = await migrator.migrate(tenant(), 'row', 'database');

    expect(result.success).toBe(false);
    expect(result.error).toBe('export failed');
  });
});
