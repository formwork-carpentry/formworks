import { describe, it, expect, beforeEach } from 'vitest';
import {
  SubdomainResolver, PathResolver, HeaderResolver, DomainResolver, ChainResolver,
  InMemoryTenantStore, TenancyManager, setTenancyManager, Tenancy,
  TenantMigrator, InMemoryTenantExporter, InMemoryTenantImporter,
} from '../src/index.js';
import type { Tenant, MigrationPhase } from '../src/index.js';

// ── Fixture ───────────────────────────────────────────────

function makeTenant(slug: string, id: string | number = slug): Tenant {
  return { id, name: slug.toUpperCase(), slug, status: 'active' };
}

// ── Resolvers ─────────────────────────────────────────────

describe('@formwork/tenancy: SubdomainResolver', () => {
  const resolver = new SubdomainResolver('app.com');

  it('resolves subdomain', async () => {
    expect(await resolver.resolve({ hostname: 'acme.app.com' })).toBe('acme');
  });

  it('returns null for bare domain', async () => {
    expect(await resolver.resolve({ hostname: 'app.com' })).toBeNull();
  });

  it('returns null for www', async () => {
    expect(await resolver.resolve({ hostname: 'www.app.com' })).toBeNull();
  });

  it('returns null for non-matching domain', async () => {
    expect(await resolver.resolve({ hostname: 'other.com' })).toBeNull();
  });

  it('returns null without hostname', async () => {
    expect(await resolver.resolve({})).toBeNull();
  });
});

describe('@formwork/tenancy: PathResolver', () => {
  it('resolves first path segment', async () => {
    const resolver = new PathResolver();
    expect(await resolver.resolve({ path: '/acme/dashboard' })).toBe('acme');
  });

  it('resolves with prefix', async () => {
    const resolver = new PathResolver('api/v1');
    expect(await resolver.resolve({ path: '/api/v1/acme/users' })).toBe('acme');
  });

  it('returns null for empty path', async () => {
    const resolver = new PathResolver();
    expect(await resolver.resolve({ path: '/' })).toBeNull();
  });
});

describe('@formwork/tenancy: HeaderResolver', () => {
  it('resolves from header', async () => {
    const resolver = new HeaderResolver('x-tenant-id');
    expect(await resolver.resolve({ headers: { 'x-tenant-id': 'acme' } })).toBe('acme');
  });

  it('returns null when header missing', async () => {
    const resolver = new HeaderResolver();
    expect(await resolver.resolve({ headers: {} })).toBeNull();
  });
});

describe('@formwork/tenancy: DomainResolver', () => {
  it('resolves from domain mapping', async () => {
    const resolver = new DomainResolver()
      .addMapping('acme.com', 'acme')
      .addMapping('widgets.io', 'widgets');

    expect(await resolver.resolve({ hostname: 'acme.com' })).toBe('acme');
    expect(await resolver.resolve({ hostname: 'widgets.io' })).toBe('widgets');
    expect(await resolver.resolve({ hostname: 'unknown.com' })).toBeNull();
  });
});

describe('@formwork/tenancy: ChainResolver', () => {
  it('tries resolvers in order', async () => {
    const chain = new ChainResolver([
      new HeaderResolver(),
      new SubdomainResolver('app.com'),
    ]);

    // Header match wins
    expect(await chain.resolve({ hostname: 'acme.app.com', headers: { 'x-tenant-id': 'from-header' } }))
      .toBe('from-header');

    // Falls back to subdomain when no header
    expect(await chain.resolve({ hostname: 'acme.app.com', headers: {} }))
      .toBe('acme');
  });

  it('returns null if none match', async () => {
    const chain = new ChainResolver([new HeaderResolver()]);
    expect(await chain.resolve({ headers: {} })).toBeNull();
  });
});

// ── TenantStore ───────────────────────────────────────────

describe('@formwork/tenancy: InMemoryTenantStore', () => {
  let store: InMemoryTenantStore;

  beforeEach(() => { store = new InMemoryTenantStore(); });

  it('create and findBySlug', async () => {
    await store.create(makeTenant('acme', 1));
    const t = await store.findBySlug('acme');
    expect(t).not.toBeNull();
    expect(t!.name).toBe('ACME');
  });

  it('findById', async () => {
    await store.create(makeTenant('acme', 1));
    expect(await store.findById(1)).not.toBeNull();
    expect(await store.findById(999)).toBeNull();
  });

  it('all()', async () => {
    await store.create(makeTenant('a', 1));
    await store.create(makeTenant('b', 2));
    expect(await store.all()).toHaveLength(2);
  });

  it('update()', async () => {
    await store.create(makeTenant('acme', 1));
    const updated = await store.update(1, { name: 'Acme Corp' });
    expect(updated!.name).toBe('Acme Corp');
  });

  it('delete()', async () => {
    await store.create(makeTenant('acme', 1));
    expect(await store.delete(1)).toBe(true);
    expect(await store.findById(1)).toBeNull();
    expect(await store.delete(999)).toBe(false);
  });
});

// ── TenancyManager ───────────────────────────────────────

describe('@formwork/tenancy: TenancyManager', () => {
  let manager: TenancyManager;
  let store: InMemoryTenantStore;

  beforeEach(async () => {
    store = new InMemoryTenantStore();
    await store.create(makeTenant('acme', 1));
    await store.create(makeTenant('widgets', 2));
    await store.create({ ...makeTenant('suspended', 3), status: 'suspended' });

    manager = new TenancyManager(new HeaderResolver(), store, 'row');
  });

  it('initialize() resolves and sets tenant', async () => {
    const tenant = await manager.initialize({ headers: { 'x-tenant-id': 'acme' } });
    expect(tenant).not.toBeNull();
    expect(tenant!.slug).toBe('acme');
    expect(manager.hasTenant()).toBe(true);
    expect(manager.tenant().id).toBe(1);
  });

  it('initialize() returns null for unknown slug', async () => {
    const tenant = await manager.initialize({ headers: { 'x-tenant-id': 'nope' } });
    expect(tenant).toBeNull();
    expect(manager.hasTenant()).toBe(false);
  });

  it('initialize() rejects suspended tenants', async () => {
    const tenant = await manager.initialize({ headers: { 'x-tenant-id': 'suspended' } });
    expect(tenant).toBeNull();
  });

  it('setTenant() manually sets tenant', () => {
    const t = makeTenant('manual', 99);
    manager.setTenant(t);
    expect(manager.tenant().slug).toBe('manual');
  });

  it('tenant() throws when no tenant', () => {
    expect(() => manager.tenant()).toThrow('No tenant');
  });

  it('end() clears tenant', async () => {
    await manager.initialize({ headers: { 'x-tenant-id': 'acme' } });
    manager.end();
    expect(manager.hasTenant()).toBe(false);
  });

  it('run() scopes operation to a tenant then restores', async () => {
    const acme = (await store.findBySlug('acme'))!;
    const widgets = (await store.findBySlug('widgets'))!;

    manager.setTenant(acme);
    expect(manager.tenant().slug).toBe('acme');

    await manager.run(widgets, async () => {
      expect(manager.tenant().slug).toBe('widgets');
    });

    // Restored back
    expect(manager.tenant().slug).toBe('acme');
  });

  it('run() restores even after error', async () => {
    const acme = (await store.findBySlug('acme'))!;
    const widgets = (await store.findBySlug('widgets'))!;

    manager.setTenant(acme);

    await expect(manager.run(widgets, async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(manager.tenant().slug).toBe('acme');
  });

  it('emits events on switch and end', async () => {
    const events: string[] = [];
    manager.on((event, tenant) => {
      events.push(`${event}:${tenant?.slug ?? 'null'}`);
    });

    await manager.initialize({ headers: { 'x-tenant-id': 'acme' } });
    manager.end();

    expect(events).toEqual(['switched:acme', 'ended:acme']);
  });

  it('getIsolation()', () => {
    expect(manager.getIsolation()).toBe('row');
  });
});

// ── Facade ────────────────────────────────────────────────

describe('@formwork/tenancy: Tenancy facade', () => {
  beforeEach(async () => {
    const store = new InMemoryTenantStore();
    await store.create(makeTenant('acme', 1));
    const manager = new TenancyManager(new HeaderResolver(), store);
    setTenancyManager(manager);
  });

  it('Tenancy.initialize() + tenant()', async () => {
    await Tenancy.initialize({ headers: { 'x-tenant-id': 'acme' } });
    expect(Tenancy.tenant().slug).toBe('acme');
    expect(Tenancy.hasTenant()).toBe(true);
  });

  it('Tenancy.end()', async () => {
    await Tenancy.initialize({ headers: { 'x-tenant-id': 'acme' } });
    Tenancy.end();
    expect(Tenancy.hasTenant()).toBe(false);
  });
});

// ── TenantMigrator ────────────────────────────────────────

describe('@formwork/tenancy: TenantMigrator', () => {
  let store: InMemoryTenantStore;
  let exporter: InMemoryTenantExporter;
  let importer: InMemoryTenantImporter;
  let migrator: TenantMigrator;
  let acme: Tenant;

  beforeEach(async () => {
    store = new InMemoryTenantStore();
    exporter = new InMemoryTenantExporter();
    importer = new InMemoryTenantImporter();
    migrator = new TenantMigrator(exporter, importer, store);

    acme = await store.create(makeTenant('acme', 1));

    // Seed some data for the tenant
    exporter.seed(1, {
      users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      orders: [{ id: 1, userId: 1, total: 99 }],
    });
  });

  it('migrates tenant from row to database isolation', async () => {
    const result = await migrator.migrate(acme, 'row', 'database');

    expect(result.success).toBe(true);
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot!.tenantId).toBe(1);

    importer.assertImported(1);
    importer.assertImportedTo(1, 'database');
  });

  it('migrates tenant from database to row isolation', async () => {
    const result = await migrator.migrate(acme, 'database', 'row');
    expect(result.success).toBe(true);
    importer.assertImportedTo(1, 'row');
  });

  it('updates tenant config after successful migration', async () => {
    await migrator.migrate(acme, 'row', 'database');
    const updated = await store.findById(1);
    expect(updated!.config?.['isolation']).toBe('database');
  });

  it('emits progress events through all phases', async () => {
    const phases: MigrationPhase[] = [];
    migrator.onProgress((p) => phases.push(p.phase));

    await migrator.migrate(acme, 'row', 'database');

    expect(phases).toContain('exporting');
    expect(phases).toContain('validating');
    expect(phases).toContain('importing');
    expect(phases).toContain('verifying');
    expect(phases).toContain('switching');
    expect(phases).toContain('complete');
  });

  it('tracks row counts in progress', async () => {
    let finalProgress: { totalTables: number; totalRows: number } | null = null;
    migrator.onProgress((p) => {
      if (p.phase === 'importing') finalProgress = { totalTables: p.totalTables, totalRows: p.totalRows };
    });

    await migrator.migrate(acme, 'row', 'database');

    expect(finalProgress!.totalTables).toBe(2); // users + orders
    expect(finalProgress!.totalRows).toBe(3);   // 2 users + 1 order
  });

  it('dryRun() exports and validates without importing', async () => {
    const result = await migrator.dryRun(acme, 'row', 'database');

    expect(result.tables).toBe(2);
    expect(result.rows).toBe(3);
    expect(result.estimatedBytes).toBeGreaterThan(0);
    expect(result.snapshot.tenantId).toBe(1);

    // No actual import should have happened
    expect(importer.getImported()).toHaveLength(0);
  });

  it('handles tenant with no data', async () => {
    const empty = await store.create(makeTenant('empty', 2));
    exporter.seed(2, {});

    const result = await migrator.migrate(empty, 'row', 'database');
    expect(result.success).toBe(true);
  });

  it('snapshot preserves table structure', async () => {
    const result = await migrator.dryRun(acme, 'row', 'database');

    expect(result.snapshot.tables['users']).toHaveLength(2);
    expect(result.snapshot.tables['orders']).toHaveLength(1);
    expect(result.snapshot.tables['users'][0]).toEqual({ id: 1, name: 'Alice' });
  });
});
