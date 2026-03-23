/**
 * @module @carpentry/tenancy
 * @description TenantMigrator — migrate tenants between isolation strategies
 * @patterns Strategy (migration strategies), Observer (progress events)
 */

import type { Tenant, IsolationStrategy } from './types.js';
import type { ITenantStore } from './store.js';

// ── Tenant Migration — move between isolation strategies ──

export interface TenantDataExporter {
  /** Export all data for a tenant from its current isolation (returns serializable snapshot) */
  /**
   * @param {Tenant} tenant
   * @returns {Promise<TenantDataSnapshot>}
   */
  export(tenant: Tenant): Promise<TenantDataSnapshot>;
}

export interface TenantDataImporter {
  /** Import a snapshot into a target isolation strategy */
  /**
   * @param {Tenant} tenant
   * @param {TenantDataSnapshot} snapshot
   * @param {IsolationStrategy} targetStrategy
   * @returns {Promise<void>}
   */
  import(tenant: Tenant, snapshot: TenantDataSnapshot, targetStrategy: IsolationStrategy): Promise<void>;
}

export interface TenantDataSnapshot {
  tenantId: string | number;
  exportedAt: Date;
  sourceStrategy: IsolationStrategy;
  tables: Record<string, Record<string, unknown>[]>;
  metadata?: Record<string, unknown>;
}

export type MigrationPhase = 'exporting' | 'validating' | 'importing' | 'verifying' | 'switching' | 'complete' | 'failed' | 'rolled-back';

export interface MigrationProgress {
  tenantId: string | number;
  phase: MigrationPhase;
  fromStrategy: IsolationStrategy;
  toStrategy: IsolationStrategy;
  tablesProcessed: number;
  totalTables: number;
  rowsProcessed: number;
  totalRows: number;
  startedAt: Date;
  error?: string;
}

export type MigrationProgressHandler = (progress: MigrationProgress) => void;

/**
 * TenantMigrator — moves a tenant between isolation strategies.
 *
 * Flow: export → validate → import → verify → switch config → done
 * Rollback: if verification fails, the old isolation is kept.
 *
 * @example
 * ```typescript
 * const migrator = new TenantMigrator(exporter, importer, store);
 * migrator.onProgress((p) => console.log(`${p.phase}: ${p.tablesProcessed}/${p.totalTables}`));
 *
 * // Move tenant from shared (row-level) DB to dedicated DB
 * await migrator.migrate(tenant, 'row', 'database');
 *
 * // Move back to shared DB
 * await migrator.migrate(tenant, 'database', 'row');
 * ```
 */
export class TenantMigrator {
  private progressHandlers: MigrationProgressHandler[] = [];

  constructor(
    private exporter: TenantDataExporter,
    private importer: TenantDataImporter,
    private store: ITenantStore,
  ) {}

  /**
   * @param {MigrationProgressHandler} handler
   */
  onProgress(handler: MigrationProgressHandler): void {
    this.progressHandlers.push(handler);
  }

  /**
   * @param {Tenant} tenant
   * @param {IsolationStrategy} from
   * @param {IsolationStrategy} to
   * @returns {Promise<MigrationResult>}
   */
  async migrate(
    tenant: Tenant,
    from: IsolationStrategy,
    to: IsolationStrategy,
  ): Promise<MigrationResult> {
    const progress: MigrationProgress = {
      tenantId: tenant.id,
      phase: 'exporting',
      fromStrategy: from,
      toStrategy: to,
      tablesProcessed: 0,
      totalTables: 0,
      rowsProcessed: 0,
      totalRows: 0,
      startedAt: new Date(),
    };

    try {
      // 1. Export
      this.emitProgress(progress);
      const snapshot = await this.exporter.export(tenant);

      const tableNames = Object.keys(snapshot.tables);
      progress.totalTables = tableNames.length;
      progress.totalRows = tableNames.reduce((sum, t) => sum + snapshot.tables[t].length, 0);

      // 2. Validate
      progress.phase = 'validating';
      this.emitProgress(progress);
      this.validateSnapshot(snapshot, tenant);

      // 3. Import
      progress.phase = 'importing';
      this.emitProgress(progress);
      await this.importer.import(tenant, snapshot, to);

      progress.tablesProcessed = progress.totalTables;
      progress.rowsProcessed = progress.totalRows;

      // 4. Verify
      progress.phase = 'verifying';
      this.emitProgress(progress);
      const verifySnapshot = await this.exporter.export({ ...tenant, config: { ...tenant.config, isolation: to } });
      const valid = this.verifyIntegrity(snapshot, verifySnapshot);

      if (!valid) {
        progress.phase = 'rolled-back';
        progress.error = 'Verification failed: row count mismatch after import.';
        this.emitProgress(progress);
        return { success: false, error: progress.error, snapshot };
      }

      // 5. Switch tenant config
      progress.phase = 'switching';
      this.emitProgress(progress);
      await this.store.update(tenant.id, {
        config: { ...tenant.config, isolation: to },
      });

      progress.phase = 'complete';
      this.emitProgress(progress);

      return { success: true, snapshot };
    } catch (error) {
      progress.phase = 'failed';
      progress.error = (error as Error).message;
      this.emitProgress(progress);
      return { success: false, error: progress.error };
    }
  }

  /** Dry run — export and validate without actually importing */
  /**
   * @param {Tenant} tenant
   * @param {IsolationStrategy} from
   * @param {IsolationStrategy} to
   * @returns {Promise<DryRunResult>}
   */
  async dryRun(tenant: Tenant, from: IsolationStrategy, to: IsolationStrategy): Promise<DryRunResult> {
    const snapshot = await this.exporter.export(tenant);
    this.validateSnapshot(snapshot, tenant);

    const tableNames = Object.keys(snapshot.tables);
    const totalRows = tableNames.reduce((sum, t) => sum + snapshot.tables[t].length, 0);

    return {
      tenantId: tenant.id,
      from, to,
      tables: tableNames.length,
      rows: totalRows,
      estimatedBytes: JSON.stringify(snapshot).length,
      snapshot,
    };
  }

  private validateSnapshot(snapshot: TenantDataSnapshot, tenant: Tenant): void {
    if (snapshot.tenantId !== tenant.id) {
      throw new Error(`Snapshot tenant ID "${snapshot.tenantId}" does not match tenant "${tenant.id}".`);
    }
  }

  private verifyIntegrity(source: TenantDataSnapshot, target: TenantDataSnapshot): boolean {
    for (const table of Object.keys(source.tables)) {
      const sourceCount = source.tables[table].length;
      const targetCount = target.tables[table]?.length ?? 0;
      if (sourceCount !== targetCount) return false;
    }
    return true;
  }

  private emitProgress(progress: MigrationProgress): void {
    for (const handler of this.progressHandlers) handler({ ...progress });
  }
}

export interface MigrationResult {
  success: boolean;
  error?: string;
  snapshot?: TenantDataSnapshot;
}

export interface DryRunResult {
  tenantId: string | number;
  from: IsolationStrategy;
  to: IsolationStrategy;
  tables: number;
  rows: number;
  estimatedBytes: number;
  snapshot: TenantDataSnapshot;
}

// ── InMemory Exporter/Importer for testing ────────────────

/**
 * Test double for {@link TenantDataExporter} — `seed` per-tenant table rows, then `export` builds a {@link TenantDataSnapshot}.
 *
 * @example
 * ```ts
 * import { InMemoryTenantExporter } from './';
 * const ex = new InMemoryTenantExporter();
 * ex.seed('t1', { users: [{ id: 1 }] });
 * ```
 *
 * @see TenantMigrator
 */
export class InMemoryTenantExporter implements TenantDataExporter {
  private data = new Map<string | number, Record<string, Record<string, unknown>[]>>();

  /** Seed data for a tenant (simulate existing DB rows) */
  /**
   * @param {string | number} tenantId
   * @param {Record<string, Object[]>} tables
   */
  seed(tenantId: string | number, tables: Record<string, Record<string, unknown>[]>): void {
    this.data.set(tenantId, tables);
  }

  /**
   * @param {Tenant} tenant
   * @returns {Promise<TenantDataSnapshot>}
   */
  async export(tenant: Tenant): Promise<TenantDataSnapshot> {
    return {
      tenantId: tenant.id,
      exportedAt: new Date(),
      sourceStrategy: (tenant.config?.['isolation'] as IsolationStrategy) ?? 'row',
      tables: this.data.get(tenant.id) ?? {},
    };
  }
}

/**
 * Test double for {@link TenantDataImporter} — records imports for assertions (`assertImported`, `getImported`).
 *
 * @example
 * ```ts
 * import { InMemoryTenantImporter } from './';
 * const im = new InMemoryTenantImporter();
 * ```
 *
 * @see TenantMigrator
 */
export class InMemoryTenantImporter implements TenantDataImporter {
  private imported: Array<{ tenant: Tenant; snapshot: TenantDataSnapshot; targetStrategy: IsolationStrategy }> = [];

  /**
   * @param {Tenant} tenant
   * @param {TenantDataSnapshot} snapshot
   * @param {IsolationStrategy} targetStrategy
   * @returns {Promise<void>}
   */
  async import(tenant: Tenant, snapshot: TenantDataSnapshot, targetStrategy: IsolationStrategy): Promise<void> {
    this.imported.push({ tenant, snapshot, targetStrategy });
  }

  getImported() { return [...this.imported]; }

  /**
   * @param {string | number} tenantId
   */
  assertImported(tenantId: string | number): void {
    if (!this.imported.some((i) => i.tenant.id === tenantId)) {
      throw new Error(`No import found for tenant "${tenantId}".`);
    }
  }

  /**
   * @param {string | number} tenantId
   * @param {IsolationStrategy} strategy
   */
  assertImportedTo(tenantId: string | number, strategy: IsolationStrategy): void {
    const match = this.imported.find((i) => i.tenant.id === tenantId && i.targetStrategy === strategy);
    if (!match) throw new Error(`No import for tenant "${tenantId}" to strategy "${strategy}".`);
  }

  reset(): void { this.imported = []; }
}
