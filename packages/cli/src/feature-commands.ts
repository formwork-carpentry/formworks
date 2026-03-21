/**
 * @module @formwork/cli
 * @description Feature management commands — add or remove framework features
 * after initial project creation.
 *
 * WHY: Developers start with a minimal setup and add features as needed.
 * `carpenter add cache` installs @formwork/cache, generates config/cache.ts,
 * updates .env with CACHE_DRIVER=memory, and adds the service provider.
 * `carpenter remove cache` reverses this (uninstalls, removes config).
 *
 * HOW: Each feature maps to a set of npm packages, config files, .env keys,
 * and optional code snippets. The add/remove commands manage all of these
 * atomically.
 *
 * @patterns Command, Strategy (per-feature install recipes)
 * @principles OCP (add new features without modifying existing code), SRP
 *
 * @example
 * ```bash
 * carpenter add cache          # Installs @formwork/cache, creates config/cache.ts
 * carpenter add mail           # Installs @formwork/mail, creates config/mail.ts
 * carpenter add ai             # Installs @formwork/ai, creates config/ai.ts
 * carpenter add tenancy        # Installs @formwork/tenancy, creates config/tenancy.ts
 * carpenter remove cache       # Uninstalls @formwork/cache, removes config
 * carpenter list-features      # Shows all available features with install status
 * ```
 */

import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

// ── Feature Registry ──────────────────────────────────────
// Each feature has: packages to install, config template, .env keys, description

export interface FeatureDefinition {
  name: string;
  description: string;
  packages: string[];
  envKeys: Record<string, string>;
  configFile?: string;
  configTemplate?: string;
}

export const FEATURES: FeatureDefinition[] = [
  {
    name: "auth",
    description: "Authentication — JWT guards, session auth, user providers",
    packages: ["@formwork/auth", "@formwork/session"],
    envKeys: {
      AUTH_GUARD: "jwt",
      JWT_SECRET: "",
      SESSION_DRIVER: "memory",
      SESSION_LIFETIME: "120",
    },
    configFile: "src/config/auth.ts",
    configTemplate: `import { env } from '@formwork/core';

export default {
  defaultGuard: env('AUTH_GUARD', 'jwt'),
  guards: {
    jwt: { driver: 'jwt', secret: env('JWT_SECRET', 'change-me'), expiresIn: 3600 },
    session: { driver: 'session' },
  },
};
`,
  },
  {
    name: "cache",
    description: "Caching — memory, file, Redis stores with cache tags",
    packages: ["@formwork/cache"],
    envKeys: { CACHE_DRIVER: "memory", REDIS_URL: "redis://localhost:6379" },
    configFile: "src/config/cache.ts",
    configTemplate: `import { env } from '@formwork/core';

export default {
  default: env('CACHE_DRIVER', 'memory'),
  stores: {
    memory: { driver: 'memory' },
    file: { driver: 'file', path: 'storage/cache' },
    redis: { driver: 'redis', url: env('REDIS_URL', 'redis://localhost:6379') },
  },
};
`,
  },
  {
    name: "queue",
    description: "Background jobs — sync, database, BullMQ (Redis) drivers",
    packages: ["@formwork/queue"],
    envKeys: { QUEUE_CONNECTION: "sync", QUEUE_TABLE: "jobs" },
    configFile: "src/config/queue.ts",
    configTemplate: `import { env } from '@formwork/core';

export default {
  default: env('QUEUE_CONNECTION', 'sync'),
  connections: {
    sync: { driver: 'sync' },
    database: { driver: 'database', table: env('QUEUE_TABLE', 'jobs') },
    redis: { driver: 'bullmq', url: env('REDIS_URL', 'redis://localhost:6379') },
  },
};
`,
  },
  {
    name: "mail",
    description: "Email — SMTP, Resend, SendGrid, Postmark, Mailgun",
    packages: ["@formwork/mail"],
    envKeys: {
      MAIL_MAILER: "log",
      MAIL_FROM_ADDRESS: "noreply@example.com",
      MAIL_FROM_NAME: "Carpenter",
    },
    configFile: "src/config/mail.ts",
    configTemplate: `import { env } from '@formwork/core';

export default {
  default: env('MAIL_MAILER', 'log'),
  mailers: {
    log: { driver: 'log' },
    smtp: { driver: 'smtp', host: env('MAIL_HOST', ''), port: env('MAIL_PORT', 587) },
    resend: { driver: 'resend', apiKey: env('RESEND_API_KEY', '') },
    sendgrid: { driver: 'sendgrid', apiKey: env('SENDGRID_API_KEY', '') },
  },
  from: { address: env('MAIL_FROM_ADDRESS', 'noreply@example.com'), name: env('MAIL_FROM_NAME', 'Carpenter') },
};
`,
  },
  {
    name: "storage",
    description: "File storage — local filesystem, S3, MinIO, R2",
    packages: ["@formwork/storage"],
    envKeys: { FILESYSTEM_DISK: "local", STORAGE_PATH: "storage/app" },
    configFile: "src/config/storage.ts",
    configTemplate: `import { env } from '@formwork/core';

export default {
  default: env('FILESYSTEM_DISK', 'local'),
  disks: {
    local: { driver: 'local', root: env('STORAGE_PATH', 'storage/app') },
    s3: { driver: 's3', bucket: env('AWS_BUCKET', ''), region: env('AWS_DEFAULT_REGION', 'us-east-1') },
  },
};
`,
  },
  {
    name: "realtime",
    description: "WebSocket broadcasting — channels, presence, CRDT collaboration",
    packages: ["@formwork/realtime"],
    envKeys: { BROADCAST_DRIVER: "memory" },
  },
  {
    name: "i18n",
    description: "Internationalization — translations, pluralization, locale switching",
    packages: ["@formwork/i18n"],
    envKeys: { APP_LOCALE: "en", APP_FALLBACK_LOCALE: "en" },
  },
  {
    name: "tenancy",
    description: "Multi-tenant — subdomain/path/header resolution, scoped DB/cache/storage",
    packages: ["@formwork/tenancy"],
    envKeys: { TENANCY_RESOLVER: "subdomain" },
  },
  {
    name: "ai",
    description: "AI/LLM — Anthropic, OpenAI, Groq, Ollama providers + RAG + Agent",
    packages: ["@formwork/ai"],
    envKeys: { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" },
    configFile: "src/config/ai.ts",
    configTemplate: `import { env } from '@formwork/core';

export default {
  default: env('AI_PROVIDER', 'anthropic'),
  providers: {
    anthropic: { driver: 'anthropic', apiKey: env('ANTHROPIC_API_KEY', '') },
    openai: { driver: 'openai', apiKey: env('OPENAI_API_KEY', '') },
    ollama: { driver: 'ollama', baseUrl: 'http://localhost:11434' },
  },
};
`,
  },
  {
    name: "graphql",
    description: "GraphQL — schema builder, code-first decorators, Federation v2, PubSub",
    packages: ["@formwork/graphql"],
    envKeys: {},
  },
  {
    name: "admin",
    description: "Admin panel — auto-generated CRUD dashboard for models",
    packages: ["@formwork/admin"],
    envKeys: { ADMIN_PATH: "/admin" },
  },
  {
    name: "billing",
    description: "Billing — charges, subscriptions, invoices, webhooks",
    packages: ["@formwork/billing"],
    envKeys: { BILLING_PROVIDER: "stripe", STRIPE_KEY: "", STRIPE_SECRET: "" },
  },
  {
    name: "otel",
    description: "Observability — OpenTelemetry tracing, metrics, OTLP export",
    packages: ["@formwork/otel"],
    envKeys: { OTEL_ENDPOINT: "http://localhost:4318" },
  },
  {
    name: "flags",
    description: "Feature flags — rollout percentages, A/B experiments, targeting",
    packages: ["@formwork/flags"],
    envKeys: { FLAG_PROVIDER: "memory" },
  },
];

// ── carpenter add <feature> ───────────────────────────────

/**
 * CLI command `add` — installs packages, writes config templates, and appends `.env` keys for a `FEATURES` entry.
 *
 * @example
 * ```ts
 * import { CliApp, AddFeatureCommand } from '@formwork/cli';
 * await new CliApp().register(new AddFeatureCommand()).run(['add', 'cache']);
 * ```
 *
 * @see BaseCommand
 */
export class AddFeatureCommand extends BaseCommand {
  name = "add";
  description = "Add a feature to your Carpenter application";

  constructor() {
    super();
    this.argument("feature", "Feature to add (e.g., cache, mail, ai, tenancy)");
  }

  /**
   * @param {Record<string, string>} args
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
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
      output.info(`Available: ${FEATURES.map((f) => f.name).join(", ")}`);
      return 1;
    }

    output.info(`📦 Adding "${feature.name}" — ${feature.description}`);
    output.info("");

    // 1. Install packages
    output.info(`  Installing: ${feature.packages.join(", ")}`);
    try {
      const { execSync } = await import("node:child_process");
      execSync(`npm install ${feature.packages.join(" ")}`, { stdio: "inherit" });
    } catch {
      output.error(
        `  npm install failed — install manually: npm install ${feature.packages.join(" ")}`,
      );
    }

    // 2. Generate config file
    if (feature.configFile && feature.configTemplate) {
      output.info(`  Creating: ${feature.configFile}`);
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { dirname } = await import("node:path");
      mkdirSync(dirname(feature.configFile), { recursive: true });
      writeFileSync(feature.configFile, feature.configTemplate, "utf-8");
    }

    // 3. Add .env keys
    if (Object.keys(feature.envKeys).length > 0) {
      output.info(`  Adding to .env: ${Object.keys(feature.envKeys).join(", ")}`);
      try {
        const { appendFileSync, existsSync } = await import("node:fs");
        const envPath = ".env";
        const lines = Object.entries(feature.envKeys).map(([k, v]) => `${k}=${v}`);
        const block = `\n# ${feature.name}\n${lines.join("\n")}\n`;
        if (existsSync(envPath)) {
          appendFileSync(envPath, block, "utf-8");
        }
      } catch {
        output.error("  Could not update .env — add keys manually");
      }
    }

    output.info("");
    output.success(`"${feature.name}" added successfully!`);
    return 0;
  }
}

// ── carpenter remove <feature> ────────────────────────────

/**
 * CLI command `remove` — uninstalls packages and deletes known config files for a `FEATURES` entry.
 *
 * @example
 * ```ts
 * import { CliApp, RemoveFeatureCommand } from '@formwork/cli';
 * await new CliApp().register(new RemoveFeatureCommand()).run(['remove', 'cache']);
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

  /**
   * @param {Record<string, string>} args
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
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

    output.info(`🗑️  Removing "${feature.name}"...`);
    output.info(`  Uninstalling: ${feature.packages.join(", ")}`);
    try {
      const { execSync } = await import("node:child_process");
      execSync(`npm uninstall ${feature.packages.join(" ")}`, { stdio: "inherit" });
    } catch {
      output.error("  npm uninstall failed — remove manually");
    }

    if (feature.configFile) {
      output.info(`  Removing: ${feature.configFile}`);
      try {
        const { unlinkSync, existsSync } = await import("node:fs");
        if (existsSync(feature.configFile)) unlinkSync(feature.configFile);
      } catch {
        output.error(`  Could not remove ${feature.configFile}`);
      }
    }
    output.info("");
    output.success(`"${feature.name}" removed.`);
    return 0;
  }
}

// ── carpenter list-features ───────────────────────────────

/**
 * CLI command `list-features` — prints `FEATURES` names, descriptions, and related packages.
 *
 * @example
 * ```ts
 * import { CliApp, ListFeaturesCommand } from '@formwork/cli';
 * await new CliApp().register(new ListFeaturesCommand()).run(['list-features']);
 * ```
 *
 * @see BaseCommand
 */
export class ListFeaturesCommand extends BaseCommand {
  name = "list-features";
  description = "List all available Carpenter features";

  /**
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    _args: Record<string, string>,
    _options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    output.info("🪚 Available Carpenter Features:");
    output.info("");

    for (const feature of FEATURES) {
      const pkgs = feature.packages.join(", ");
      output.info(`  ${feature.name.padEnd(12)} ${feature.description}`);
      output.info(`  ${"".padEnd(12)} packages: ${pkgs}`);
      output.info("");
    }

    output.info("  Add a feature:    carpenter add <feature>");
    output.info("  Remove a feature: carpenter remove <feature>");
    return 0;
  }
}
