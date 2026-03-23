/**
 * @module @carpentry/cli
 * @description Feature management commands — add or remove framework features
 * after initial project creation.
 *
 * WHY: Developers start with a minimal setup and add features as needed.
 * `carpenter add postgres` installs @carpentry/db-postgres, generates config,
 * updates .env. `carpenter add tenancy` only scaffolds config — it's built-in.
 *
 * HOW: Each feature has a tier:
 *   - builtin:  already in @carpentry/formworks, config scaffolding only
 *   - optional: separate @carpentry/* package with heavy/optional deps
 *   - adapter:  separate @carpentry/* package for a specific external driver
 *
 * @patterns Command, Strategy (per-feature install recipes)
 * @principles OCP (add new features without modifying existing code), SRP
 *
 * @example
 * ```bash
 * carpenter add postgres        # Installs @carpentry/db-postgres
 * carpenter add redis           # Installs @carpentry/cache-redis
 * carpenter add ai              # Installs @carpentry/ai
 * carpenter add tenancy         # Config only — already in @carpentry/formworks
 * carpenter remove postgres     # Uninstalls @carpentry/db-postgres
 * carpenter list-features       # Shows all available features with install status
 * ```
 */

import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

// ── Feature Registry ──────────────────────────────────────

export interface Feature {
  /** The CLI name — what developers type after `carpenter add` */
  name: string
  /**
   * npm package to install.
   * null = feature is built into @carpentry/formworks, only config scaffolding needed
   */
  package: string | null
  /**
   * builtin: already in @carpentry/formworks, zero install
   * optional: separate @carpentry/* package with optional/heavy deps
   * adapter: separate @carpentry/* package for a specific external driver
   */
  tier: 'builtin' | 'optional' | 'adapter'
  /** Config file to scaffold in src/config/ */
  configFile?: string
  /** Environment variables to append to .env */
  envVars?: string[]
  /** Human-readable description shown in `carpenter add --list` */
  description: string
}

export const FEATURES: Feature[] = [

  // ══════════════════════════════════════════════
  // TIER 3 — ADAPTERS (always install a package)
  // ══════════════════════════════════════════════

  {
    name: 'postgres',
    package: '@carpentry/db-postgres',
    tier: 'adapter',
    configFile: 'src/config/database.ts',
    envVars: [
      'DB_CONNECTION=postgres',
      'DB_HOST=localhost',
      'DB_PORT=5432',
      'DB_DATABASE=myapp',
      'DB_USERNAME=postgres',
      'DB_PASSWORD=',
    ],
    description: 'PostgreSQL database adapter',
  },
  {
    name: 'mysql',
    package: '@carpentry/db-mysql',
    tier: 'adapter',
    configFile: 'src/config/database.ts',
    envVars: [
      'DB_CONNECTION=mysql',
      'DB_HOST=localhost',
      'DB_PORT=3306',
      'DB_DATABASE=myapp',
      'DB_USERNAME=root',
      'DB_PASSWORD=',
    ],
    description: 'MySQL database adapter',
  },
  {
    name: 'sqlite',
    package: '@carpentry/db-sqlite',
    tier: 'adapter',
    configFile: 'src/config/database.ts',
    envVars: [
      'DB_CONNECTION=sqlite',
      'DB_DATABASE=./storage/database.sqlite',
    ],
    description: 'SQLite database adapter (default for new projects)',
  },
  {
    name: 'mongodb',
    package: '@carpentry/db-mongodb',
    tier: 'adapter',
    configFile: 'src/config/database.ts',
    envVars: [
      'DB_CONNECTION=mongodb',
      'DB_URL=mongodb://localhost:27017/myapp',
    ],
    description: 'MongoDB database adapter',
  },
  {
    name: 'redis',
    package: '@carpentry/cache-redis',
    tier: 'adapter',
    configFile: 'src/config/cache.ts',
    envVars: [
      'CACHE_STORE=redis',
      'REDIS_URL=redis://localhost:6379',
    ],
    description: 'Redis cache adapter',
  },
  {
    name: 'bullmq',
    package: '@carpentry/queue-bullmq',
    tier: 'adapter',
    configFile: 'src/config/queue.ts',
    envVars: [
      'QUEUE_CONNECTION=bullmq',
    ],
    description: 'BullMQ queue adapter (requires Redis)',
  },
  {
    name: 's3',
    package: '@carpentry/storage-s3',
    tier: 'adapter',
    configFile: 'src/config/storage.ts',
    envVars: [
      'FILESYSTEM_DISK=s3',
      'AWS_BUCKET=',
      'AWS_REGION=us-east-1',
      'AWS_ACCESS_KEY_ID=',
      'AWS_SECRET_ACCESS_KEY=',
    ],
    description: 'AWS S3 (or compatible) storage adapter',
  },
  {
    name: 'smtp',
    package: '@carpentry/mail-smtp',
    tier: 'adapter',
    configFile: 'src/config/mail.ts',
    envVars: [
      'MAIL_MAILER=smtp',
      'MAIL_HOST=localhost',
      'MAIL_PORT=587',
      'MAIL_USERNAME=',
      'MAIL_PASSWORD=',
      'MAIL_FROM_ADDRESS=noreply@example.com',
    ],
    description: 'SMTP mail adapter',
  },
  {
    name: 'mail-http',
    package: '@carpentry/mail-http',
    tier: 'adapter',
    configFile: 'src/config/mail.ts',
    envVars: [
      'MAIL_MAILER=http',
      'MAIL_FROM_ADDRESS=noreply@example.com',
    ],
    description: 'HTTP mail adapter (Resend, Mailgun, Postmark)',
  },
  {
    name: 'grpc',
    package: '@carpentry/bridge-grpc',
    tier: 'adapter',
    description: 'gRPC transport for polyglot microservices',
  },
  {
    name: 'nats',
    package: '@carpentry/bridge-nats',
    tier: 'adapter',
    description: 'NATS transport for polyglot microservices',
  },
  {
    name: 'kafka',
    package: '@carpentry/bridge-kafka',
    tier: 'adapter',
    description: 'Apache Kafka transport for event streaming',
  },
  {
    name: 'turso',
    package: '@carpentry/db-turso',
    tier: 'adapter',
    configFile: 'src/config/database.ts',
    envVars: [
      'DB_CONNECTION=turso',
      'TURSO_URL=libsql://your-db.turso.io',
      'TURSO_AUTH_TOKEN=',
    ],
    description: 'Turso/libSQL database adapter (SQLite at the edge)',
  },
  {
    name: 'gcs',
    package: '@carpentry/storage-gcs',
    tier: 'adapter',
    configFile: 'src/config/storage.ts',
    envVars: [
      'FILESYSTEM_DISK=gcs',
      'GCS_BUCKET=',
      'GCS_PROJECT_ID=',
      'GCS_KEY_FILE=',
    ],
    description: 'Google Cloud Storage adapter',
  },
  {
    name: 'azure-storage',
    package: '@carpentry/storage-azure',
    tier: 'adapter',
    configFile: 'src/config/storage.ts',
    envVars: [
      'FILESYSTEM_DISK=azure',
      'AZURE_STORAGE_ACCOUNT=',
      'AZURE_STORAGE_CONTAINER=',
      'AZURE_STORAGE_KEY=',
    ],
    description: 'Azure Blob Storage adapter',
  },
  {
    name: 'memcached',
    package: '@carpentry/cache-memcached',
    tier: 'adapter',
    configFile: 'src/config/cache.ts',
    envVars: [
      'CACHE_STORE=memcached',
      'MEMCACHED_SERVERS=localhost:11211',
    ],
    description: 'Memcached cache adapter',
  },
  {
    name: 'sqs',
    package: '@carpentry/queue-sqs',
    tier: 'adapter',
    configFile: 'src/config/queue.ts',
    envVars: [
      'QUEUE_CONNECTION=sqs',
      'AWS_SQS_QUEUE_URL=',
      'AWS_REGION=us-east-1',
      'AWS_ACCESS_KEY_ID=',
      'AWS_SECRET_ACCESS_KEY=',
    ],
    description: 'AWS SQS queue adapter',
  },
  {
    name: 'queue-database',
    package: '@carpentry/queue-database',
    tier: 'adapter',
    configFile: 'src/config/queue.ts',
    envVars: [
      'QUEUE_CONNECTION=database',
    ],
    description: 'Database-backed queue adapter (uses ORM, zero external deps)',
  },

  // ══════════════════════════════════════════════
  // TIER 2 — OPTIONAL PACKAGES (install a package)
  // ══════════════════════════════════════════════

  {
    name: 'ai',
    package: '@carpentry/ai',
    tier: 'optional',
    configFile: 'src/config/ai.ts',
    envVars: [
      'AI_PROVIDER=anthropic',
      'ANTHROPIC_API_KEY=',
      '# OPENAI_API_KEY=',
    ],
    description: 'AI/LLM — streaming, agents, RAG pipelines, MCP',
  },
  {
    name: 'admin',
    package: '@carpentry/admin',
    tier: 'optional',
    description: 'Auto-generated admin panel (CarpenterAdmin)',
  },
  {
    name: 'padlock',
    package: '@carpentry/padlock',
    tier: 'optional',
    description: 'Advanced auth — MFA, TOTP, account lockout, 2FA',
  },
  {
    name: 'sociallock',
    package: '@carpentry/sociallock',
    tier: 'optional',
    description: 'OAuth social login — Google, GitHub, Facebook, etc.',
  },
  {
    name: 'billing',
    package: '@carpentry/billing',
    tier: 'optional',
    configFile: 'src/config/billing.ts',
    envVars: [
      'BILLING_PROVIDER=stripe',
      'STRIPE_SECRET_KEY=',
      'STRIPE_WEBHOOK_SECRET=',
    ],
    description: 'Subscription billing (Stripe, Paddle)',
  },
  {
    name: 'graphql',
    package: '@carpentry/graphql',
    tier: 'optional',
    description: 'GraphQL API — code-first schema, DataLoader, federation',
  },
  {
    name: 'realtime',
    package: '@carpentry/realtime',
    tier: 'optional',
    description: 'Real-time collaboration — CRDT documents, presence',
  },
  {
    name: 'otel',
    package: '@carpentry/otel',
    tier: 'optional',
    configFile: 'src/config/otel.ts',
    envVars: [
      'OTEL_ENABLED=true',
      'OTEL_SERVICE_NAME=my-app',
      'OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317',
    ],
    description: 'OpenTelemetry — traces, Prometheus metrics, structured logs',
  },
  {
    name: 'edge',
    package: '@carpentry/edge',
    tier: 'optional',
    description: 'Edge runtime — Cloudflare Workers, Vercel Edge, Deno Deploy',
  },
  {
    name: 'wasm',
    package: '@carpentry/wasm',
    tier: 'optional',
    description: 'WebAssembly module integration',
  },
  {
    name: 'mcp',
    package: '@carpentry/mcp',
    tier: 'optional',
    description: 'Model Context Protocol client and server',
  },
  {
    name: 'broadcasting',
    package: '@carpentry/broadcasting',
    tier: 'optional',
    configFile: 'src/config/broadcasting.ts',
    envVars: [
      'BROADCAST_DRIVER=log',
      '# PUSHER_APP_ID=',
      '# PUSHER_APP_KEY=',
      '# PUSHER_APP_SECRET=',
    ],
    description: 'Broadcasting — Pusher, Soketi, Ably, log, and null drivers',
  },
  {
    name: 'search',
    package: '@carpentry/search',
    tier: 'optional',
    configFile: 'src/config/search.ts',
    envVars: [
      'SEARCH_DRIVER=database',
      '# MEILISEARCH_HOST=http://localhost:7700',
      '# MEILISEARCH_KEY=',
    ],
    description: 'Full-text search — database, Meilisearch, Typesense drivers',
  },
  {
    name: 'audit',
    package: '@carpentry/audit',
    tier: 'optional',
    configFile: 'src/config/audit.ts',
    envVars: [
      'AUDIT_DRIVER=database',
    ],
    description: 'Audit logging — track model changes, user actions, and events',
  },
  {
    name: 'webhook',
    package: '@carpentry/webhook',
    tier: 'optional',
    configFile: 'src/config/webhook.ts',
    description: 'Incoming webhooks — signature verification, event routing',
  },
  {
    name: 'health',
    package: '@carpentry/health',
    tier: 'optional',
    description: 'Health checks — database, cache, memory, disk, custom checks',
  },
  {
    name: 'pdf',
    package: '@carpentry/pdf',
    tier: 'optional',
    description: 'PDF generation — invoices, reports, certificates (Puppeteer, Playwright)',
  },
  {
    name: 'analytics',
    package: '@carpentry/analytics',
    tier: 'optional',
    configFile: 'src/config/analytics.ts',
    envVars: [
      'ANALYTICS_DRIVER=log',
      '# POSTHOG_API_KEY=',
      '# MIXPANEL_TOKEN=',
    ],
    description: 'Event tracking — PostHog, Mixpanel, Segment, Amplitude',
  },
  {
    name: 'geo',
    package: '@carpentry/geo',
    tier: 'optional',
    configFile: 'src/config/geo.ts',
    envVars: [
      'GEO_DRIVER=nominatim',
      '# GOOGLE_MAPS_API_KEY=',
      '# MAPBOX_ACCESS_TOKEN=',
    ],
    description: 'Geocoding, distance, IP-to-location — Google, Mapbox, Nominatim',
  },
  {
    name: 'excel',
    package: '@carpentry/excel',
    tier: 'optional',
    description: 'Spreadsheets — XLSX/CSV generation, parsing, bulk import/export',
  },
  {
    name: 'ui-react',
    package: '@carpentry/ui-react',
    tier: 'optional',
    description: 'React adapter for Carpenter islands UI runtime',
  },
  {
    name: 'ui-vue',
    package: '@carpentry/ui-vue',
    tier: 'optional',
    description: 'Vue adapter for Carpenter islands UI runtime',
  },
  {
    name: 'ui-svelte',
    package: '@carpentry/ui-svelte',
    tier: 'optional',
    description: 'Svelte adapter for Carpenter islands UI runtime',
  },
  {
    name: 'ui-solid',
    package: '@carpentry/ui-solid',
    tier: 'optional',
    description: 'Solid adapter for Carpenter islands UI runtime',
  },
  {
    name: 'ui-charts',
    package: '@carpentry/ui-charts',
    tier: 'optional',
    description: 'Charting primitives and helpers for Carpenter UI pages',
  },
  {
    name: 'icons',
    package: '@carpentry/icons',
    tier: 'optional',
    description: 'Shared SVG icon and country-flag placeholders for UI packages',
  },

  // ══════════════════════════════════════════════
  // TIER 1 — BUILTINS (zero install, config only)
  // These are already inside @carpentry/formworks
  // ══════════════════════════════════════════════

  {
    name: 'queue',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/queue.ts',
    envVars: ['QUEUE_CONNECTION=sync'],
    description: 'Queue system — add bullmq adapter for production',
  },
  {
    name: 'cache',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/cache.ts',
    envVars: ['CACHE_STORE=memory'],
    description: 'Cache system — add redis adapter for production',
  },
  {
    name: 'mail',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/mail.ts',
    envVars: ['MAIL_MAILER=log', 'MAIL_FROM_ADDRESS=noreply@example.com'],
    description: 'Mail system — add smtp or mail-http adapter for production',
  },
  {
    name: 'storage',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/storage.ts',
    envVars: ['FILESYSTEM_DISK=local'],
    description: 'File storage — add s3 adapter for production',
  },
  {
    name: 'tenancy',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/tenancy.ts',
    description: 'Multi-tenancy — shared or per-tenant DB/cache/storage',
  },
  {
    name: 'i18n',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/i18n.ts',
    envVars: ['APP_LOCALE=en', 'APP_FALLBACK_LOCALE=en'],
    description: 'Internationalisation and localisation',
  },
  {
    name: 'flags',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/flags.ts',
    description: 'Feature flags — local, database, and LaunchDarkly drivers',
  },
  {
    name: 'scheduler',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/schedule.ts',
    description: 'Task scheduler — cron-style scheduled jobs',
  },
  {
    name: 'notifications',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/notifications.ts',
    description: 'Notification system — mail, database, and broadcast channels',
  },
  {
    name: 'session',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/session.ts',
    envVars: ['SESSION_DRIVER=file', 'SESSION_LIFETIME=120'],
    description: 'Session management — file, database, Redis drivers',
  },
  {
    name: 'log',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/logging.ts',
    envVars: ['LOG_LEVEL=debug', 'LOG_CHANNEL=console'],
    description: 'Structured logging — console, file, and channel stacking',
  },
  {
    name: 'encrypt',
    package: null,
    tier: 'builtin',
    configFile: 'src/config/encrypt.ts',
    envVars: ['APP_KEY='],
    description: 'Encryption — AES-256-GCM encrypt/decrypt, key generation',
  },
  {
    name: 'pipeline',
    package: null,
    tier: 'builtin',
    description: 'Generic pipeline — Chain of Responsibility for middleware, jobs, transforms',
  },
  {
    name: 'number',
    package: null,
    tier: 'builtin',
    description: 'Money & numbers — currency-aware arithmetic, formatting, conversion',
  },
  {
    name: 'crypto',
    package: null,
    tier: 'builtin',
    description: 'Crypto primitives — token generation, HMAC, constant-time comparison',
  },
]

// ── carpenter add <feature> ───────────────────────────────

function generateConfigStub(feature: Feature): string {
  return `/**
 * ${feature.name} configuration
 * Added by: carpenter add ${feature.name}
 * Package:  ${feature.package ?? '@carpentry/formworks (built-in)'}
 */
import { env } from '@carpentry/formworks/core'

export default {
  // Configure ${feature.name} here
  // See docs: https://carpenter.dev/docs/${feature.name}
}
`
}

/**
 * CLI command `add` — installs packages, writes config templates, and appends `.env` keys.
 *
 * @example
 * ```ts
 * import { CliApp, AddFeatureCommand } from '@carpentry/cli';
 * await new CliApp().register(new AddFeatureCommand()).run(['add', 'postgres']);
 * ```
 *
 * @see BaseCommand
 */
export class AddFeatureCommand extends BaseCommand {
  name = "add";
  description = "Add a feature to your Carpenter application";

  constructor() {
    super();
    this.argument("feature", "Feature to add (e.g., postgres, redis, ai, tenancy)");
  }

  async handle(
    args: Record<string, string>,
    _options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const featureName = args.feature;
    if (!featureName) {
      output.error("Please specify a feature: carpenter add <feature>");
      output.info("Run `carpenter list-features` to see available features.");
      return 1;
    }

    const feature = FEATURES.find((f) => f.name === featureName);
    if (!feature) {
      output.error(`Unknown feature: "${featureName}"`);
      const available = FEATURES.map(f => `  ${f.name.padEnd(18)} ${f.description}`).join('\n')
      output.info(`Available features:\n${available}`);
      return 1;
    }

    output.info(`\n🪚 Adding ${featureName} (${feature.tier})…`);

    // Step 1: Install package if needed (tier 2 and 3 only)
    if (feature.package !== null) {
      output.info(`   Installing ${feature.package}…`);
      try {
        const { execSync } = await import("node:child_process");
        execSync(`npm install ${feature.package}`, {
          cwd: process.cwd(),
          stdio: "inherit",
        });
      } catch {
        output.error(`Failed to install ${feature.package}. Check your network and npm credentials.`);
        return 1;
      }
    } else {
      output.info(`   Built into @carpentry/formworks — no install needed`);
    }

    // Step 2: Scaffold config file if specified
    if (feature.configFile) {
      const { writeFileSync, mkdirSync, existsSync } = await import("node:fs");
      const { dirname, join } = await import("node:path");
      const configPath = join(process.cwd(), feature.configFile);
      if (!existsSync(configPath)) {
        mkdirSync(dirname(configPath), { recursive: true });
        const stub = generateConfigStub(feature);
        writeFileSync(configPath, stub, "utf-8");
        output.info(`   Created ${feature.configFile}`);
      } else {
        output.info(`   ${feature.configFile} already exists — skipped`);
      }
    }

    // Step 3: Append env vars to .env if specified
    if (feature.envVars && feature.envVars.length > 0) {
      const { appendFileSync, existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const envPath = join(process.cwd(), ".env");
      const envExamplePath = join(process.cwd(), ".env.example");
      const block = `\n# ${featureName}\n${feature.envVars.join("\n")}\n`;

      if (existsSync(envPath)) {
        appendFileSync(envPath, block);
        output.info(`   Updated .env`);
      }
      if (existsSync(envExamplePath)) {
        appendFileSync(envExamplePath, block);
        output.info(`   Updated .env.example`);
      }
    }

    output.info(`\n✓ ${featureName} added successfully`);

    // Step 4: Print next-step hint
    if (feature.tier === "adapter") {
      output.info(`\n   Next: update your config/${feature.configFile?.split("/").pop()} and run carpenter migrate if needed`);
    } else if (feature.tier === "optional") {
      output.info(`\n   Next: import from '${feature.package}' and register the ServiceProvider`);
    } else {
      output.info(`\n   Next: review ${feature.configFile} and update your .env`);
    }

    return 0;
  }
}

// ── carpenter remove <feature> ────────────────────────────

/**
 * CLI command `remove` — uninstalls packages and prints cleanup instructions.
 *
 * @example
 * ```ts
 * import { CliApp, RemoveFeatureCommand } from '@carpentry/cli';
 * await new CliApp().register(new RemoveFeatureCommand()).run(['remove', 'postgres']);
 * ```
 *
 * @see BaseCommand
 */
export class RemoveFeatureCommand extends BaseCommand {
  name = "remove";
  description = "Remove a feature from your Carpenter application";

  constructor() {
    super();
    this.argument("feature", "Feature to remove");
  }

  async handle(
    args: Record<string, string>,
    _options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const featureName = args.feature;
    const feature = FEATURES.find((f) => f.name === featureName);
    if (!feature) {
      output.error(`Unknown feature: "${featureName}"`);
      return 1;
    }

    if (feature.package !== null) {
      output.info(`\n🪚 Removing ${feature.package}…`);
      try {
        const { execSync } = await import("node:child_process");
        execSync(`npm uninstall ${feature.package}`, { cwd: process.cwd(), stdio: "inherit" });
      } catch {
        output.error("  npm uninstall failed — remove manually");
      }
      output.info(`✓ ${feature.package} removed`);
      output.info(`  Note: config files and env vars were not removed — clean those up manually`);
    } else {
      output.info(`\n${featureName} is built into @carpentry/formworks and cannot be removed individually.`);
      output.info(`You can disable it by removing its config file: ${feature.configFile}`);
    }

    return 0;
  }
}

// ── carpenter list-features ───────────────────────────────

/**
 * CLI command `list-features` — prints all features grouped by tier.
 *
 * @example
 * ```ts
 * import { CliApp, ListFeaturesCommand } from '@carpentry/cli';
 * await new CliApp().register(new ListFeaturesCommand()).run(['list-features']);
 * ```
 *
 * @see BaseCommand
 */
export class ListFeaturesCommand extends BaseCommand {
  name = "list-features";
  description = "List all available Carpenter features";

  async handle(
    _args: Record<string, string>,
    _options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    output.info("🪚 Available Carpenter Features:");
    output.info("");

    const tiers = [
      { label: "Built-in (config only)", filter: "builtin" as const },
      { label: "Optional packages", filter: "optional" as const },
      { label: "Adapters", filter: "adapter" as const },
    ];

    for (const { label, filter } of tiers) {
      output.info(`  ── ${label} ──`);
      for (const feature of FEATURES.filter(f => f.tier === filter)) {
        const pkg = feature.package ?? "(included in @carpentry/formworks)";
        output.info(`  ${feature.name.padEnd(18)} ${feature.description}`);
        output.info(`  ${"".padEnd(18)} ${pkg}`);
      }
      output.info("");
    }

    output.info("  Add a feature:    carpenter add <feature>");
    output.info("  Remove a feature: carpenter remove <feature>");
    return 0;
  }
}
