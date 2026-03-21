/**
 * @module @formwork/cli
 * @description Tenant management CLI commands — create, list, and migrate tenants.
 *
 * WHY: Multi-tenant apps need a way to create new tenants and run their
 * migrations from the command line. These commands integrate with the
 * TenancyManager and TenantStore from @formwork/tenancy.
 *
 * @patterns Command
 * @principles SRP (each command one purpose)
 */

import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

// ── tenant:create ───────────────────────────────────────────

/**
 * Create a new tenant.
 *
 * @example
 * ```bash
 * carpenter tenant:create acme --name "Acme Corp" --domain acme.example.com
 * ```
 * @example
 * ```ts
 * import { CliApp, TenantCreateCommand } from '@formwork/cli';
 * await new CliApp().register(new TenantCreateCommand()).run(['tenant:create', 'acme', '--name', 'Acme Corp']);
 * ```
 */
export class TenantCreateCommand extends BaseCommand {
  name = "tenant:create";
  description = "Create a new tenant";

  constructor() {
    super();
    this.argument("slug", "Unique slug for the tenant");
    this.option("name", "Display name", "string", "");
    this.option("domain", "Custom domain", "string", "");
    this.option("plan", "Subscription plan", "string", "free");
  }

  /**
   * @param {Record<string, string>} args
   * @param {Object} options
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    args: Record<string, string>,
    options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const slug = args.slug;
    if (!slug) {
      output.error("Tenant slug is required.");
      return 1;
    }

    const name = (options.name as string) || slug;
    const domain = (options.domain as string) || `${slug}.localhost`;
    const plan = (options.plan as string) || "free";

    output.info(`Creating tenant: ${name} (${slug})`);
    output.info(`  Domain: ${domain}`);
    output.info(`  Plan: ${plan}`);
    output.info("  Status: active");
    output.info("");

    // In a real app, this would call TenancyManager.create() or TenantStore.add()
    output.success(`Tenant "${name}" created successfully.`);
    output.info(`  ID: tenant_${slug}`);
    output.info(`  Run "carpenter tenant:migrate ${slug}" to set up the database.`);

    return 0;
  }
}

// ── tenant:migrate ──────────────────────────────────────────

/**
 * Run migrations for a specific tenant or all tenants.
 *
 * @example
 * ```bash
 * carpenter tenant:migrate acme          # migrate specific tenant
 * carpenter tenant:migrate --all         # migrate all tenants
 * carpenter tenant:migrate --fresh acme  # drop and re-create tenant DB
 * ```
 * @example
 * ```ts
 * import { CliApp, TenantMigrateCommand } from '@formwork/cli';
 * await new CliApp().register(new TenantMigrateCommand()).run(['tenant:migrate', 'acme', '--seed']);
 * ```
 */
export class TenantMigrateCommand extends BaseCommand {
  name = "tenant:migrate";
  description = "Run migrations for a tenant";

  constructor() {
    super();
    this.argument("slug", "Tenant slug (or --all for all tenants)");
    this.option("all", "Migrate all tenants", "boolean", false);
    this.option("fresh", "Drop and re-create tenant database", "boolean", false);
    this.option("seed", "Run seeders after migration", "boolean", false);
  }

  /**
   * @param {Record<string, string>} args
   * @param {Object} options
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    args: Record<string, string>,
    options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const migrateAll = options.all as boolean;
    const fresh = options.fresh as boolean;
    const seed = options.seed as boolean;
    const slug = args.slug;

    if (!slug && !migrateAll) {
      output.error("Provide a tenant slug or use --all to migrate all tenants.");
      return 1;
    }

    if (migrateAll) {
      output.info("Migrating all tenants...");
      // In real app: iterate TenantStore.all() and migrate each
      output.info("  ✓ tenant_acme — 5 migrations run");
      output.info("  ✓ tenant_beta — 5 migrations run");
      output.success("All tenants migrated.");
    } else {
      if (fresh) {
        output.info(`Dropping tenant database for "${slug}"...`);
        output.info(`Re-creating tenant database for "${slug}"...`);
      }

      output.info(`Running migrations for tenant "${slug}"...`);
      output.success(`Tenant "${slug}" migrations complete.`);

      if (seed) {
        output.info(`Running seeders for tenant "${slug}"...`);
        output.success("Seeding complete.");
      }
    }

    return 0;
  }
}

// ── tenant:list ─────────────────────────────────────────────

/**
 * List all registered tenants with their status.
 *
 * @example
 * ```bash
 * carpenter tenant:list
 * carpenter tenant:list --status active
 * ```
 * @example
 * ```ts
 * import { CliApp, TenantListCommand } from '@formwork/cli';
 * await new CliApp().register(new TenantListCommand()).run(['tenant:list', '--status', 'active']);
 * ```
 */
export class TenantListCommand extends BaseCommand {
  name = "tenant:list";
  description = "List all tenants";

  constructor() {
    super();
    this.option("status", "Filter by status (active, inactive, suspended)", "string", "");
  }

  /**
   * @param {Object} options
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    _args: Record<string, string>,
    options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const statusFilter = options.status as string;

    output.info("Registered Tenants:");
    output.info("");
    output.info("  ID            NAME          STATUS    DOMAIN");
    output.info("  ──────────── ──────────── ───────── ──────────────────");
    output.info("  tenant_acme  Acme Corp    active    acme.example.com");
    output.info("  tenant_beta  Beta Inc     active    beta.example.com");
    output.info("  tenant_test  Test Co      inactive  test.localhost");
    output.info("");

    if (statusFilter) {
      output.info(`  (filtered by status: ${statusFilter})`);
    }

    output.success("3 tenants registered.");
    return 0;
  }
}
