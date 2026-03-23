/**
 * @module @carpentry/cli
 * @description Built-in generator commands — make:model, make:controller, make:migration, etc.
 * @patterns Template Method (GeneratorCommand), Factory (file templates)
 */

import { runCli as runCreateCarpenterAppCli } from "create-carpenter-app/cli";
import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

type NewAppRunner = (argv: string[]) => Promise<number>;

/**
 * CLI command `new` — delegates to the interactive Carpenter application scaffolder.
 *
 * @example
 * ```ts
 * import { CliApp, NewAppCommand } from '@carpentry/cli';
 * await new CliApp().register(new NewAppCommand()).run(['new', 'my-app', '--preset', 'minimal']);
 * ```
 */
export class NewAppCommand extends BaseCommand {
  name = "new";
  description = "Create a new Carpenter application";

  constructor(private readonly runScaffolder: NewAppRunner = runCreateCarpenterAppCli) {
    super();
    this.argument("name", "Name of the project to create", false);
    this.option("preset", "Project template preset", "string");
    this.option("db", "Database driver", "string");
    this.option("ui", "UI framework", "string");
    this.option("features", "Comma-separated feature list", "string");
    this.option("pm", "Package manager", "string");
    this.option("skip-install", "Skip dependency installation", "boolean");
  }

  async handle(
    args: Record<string, string>,
    options: Record<string, unknown>,
    _output: CommandOutput,
  ): Promise<number> {
    const argv: string[] = [];

    if (args.name) {
      argv.push(args.name);
    }

    const optionMap: Array<[string, unknown]> = [
      ["preset", options["preset"]],
      ["db", options["db"]],
      ["ui", options["ui"]],
      ["features", options["features"]],
      ["pm", options["pm"]],
    ];

    for (const [flag, value] of optionMap) {
      if (typeof value === "string" && value.length > 0) {
        argv.push(`--${flag}`, value);
      }
    }

    if (options["skip-install"] === true) {
      argv.push("--skip-install");
    }

    return this.runScaffolder(argv);
  }
}

// ── Generator Base ────────────────────────────────────────

abstract class GeneratorCommand extends BaseCommand {
  protected abstract templateName: string;
  protected abstract outputDir: string;

  constructor() {
    super();
    this.argument("name", "Name of the class to generate");
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
    const name = args.name;
    if (!name) {
      output.error("Name is required.");
      return 1;
    }

    const content = this.generateTemplate(name);
    const path = `${this.outputDir}/${name}.ts`;
    output.success(`Created ${this.templateName}: ${path}`);
    output.info(content);
    return 0;
  }

  protected abstract generateTemplate(name: string): string;
}

// ── make:model ────────────────────────────────────────────

/**
 * CLI command `make:model` — prints a `BaseModel` subclass stub under `src/models` (from `@carpentry/formworks/orm`).
 *
 * @example
 * ```ts
 * import { CliApp, MakeModelCommand } from '@carpentry/cli';
 * await new CliApp().register(new MakeModelCommand()).run(['make:model', 'Post']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeModelCommand extends GeneratorCommand {
  name = "make:model";
  description = "Generate a new model class";
  protected templateName = "Model";
  protected outputDir = "src/models";

  constructor() {
    super();
    this.option("migration", "Also generate a migration", "boolean");
    this.option("factory", "Also generate a factory", "boolean");
  }

  protected generateTemplate(name: string): string {
    const table = `${name.toLowerCase()}s`;
    return `import { BaseModel } from '@carpentry/formworks/orm';

export class ${name} extends BaseModel {
  static table = '${table}';
  static fillable = [];
  static timestamps = true;
  static userstamps = false;
}
`;
  }
}

// ── make:controller ───────────────────────────────────────

/**
 * CLI command `make:controller` — emits a `BaseController` stub (plain, resource, or API) for `@carpentry/formworks/http`.
 *
 * @example
 * ```ts
 * import { CliApp, MakeControllerCommand } from '@carpentry/cli';
 * await new CliApp().register(new MakeControllerCommand()).run(['make:controller', 'Posts', '--resource']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeControllerCommand extends GeneratorCommand {
  name = "make:controller";
  description = "Generate a new controller class";
  protected templateName = "Controller";
  protected outputDir = "src/controllers";

  constructor() {
    super();
    this.option("resource", "Generate a resource controller with CRUD methods", "boolean");
    this.option("api", "Generate an API controller (no create/edit views)", "boolean");
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
    const name = args.name;
    if (!name) {
      output.error("Name is required.");
      return 1;
    }

    const isResource = options.resource as boolean;
    const isApi = options.api as boolean;
    const content =
      isResource || isApi ? this.resourceTemplate(name, isApi) : this.generateTemplate(name);

    output.success(`Created Controller: ${this.outputDir}/${name}.ts`);
    output.info(content);
    return 0;
  }

  protected generateTemplate(name: string): string {
    return `import { BaseController } from '@carpentry/formworks/http';

export class ${name} extends BaseController {
  async index() {
    return this.json({ message: '${name} index' });
  }
}
`;
  }

  private resourceTemplate(name: string, api: boolean): string {
    const methods = ["index", "show", "store", "update", "destroy"];
    if (!api) methods.splice(1, 0, "create", "edit");

    const methodBodies = methods
      .map((m) => {
        switch (m) {
          case "index":
            return "  async index() {\n    return this.json({ data: [] });\n  }";
          case "create":
            return `  async create() {\n    return this.view('${name}/Create');\n  }`;
          case "store":
            return "  async store() {\n    return this.created({ data: {} });\n  }";
          case "show":
            return "  async show() {\n    return this.json({ data: null });\n  }";
          case "edit":
            return `  async edit() {\n    return this.view('${name}/Edit');\n  }`;
          case "update":
            return "  async update() {\n    return this.json({ data: {} });\n  }";
          case "destroy":
            return "  async destroy() {\n    return this.noContent();\n  }";
          default:
            return "";
        }
      })
      .join("\n\n");

    return `import { BaseController } from '@carpentry/formworks/http';

export class ${name} extends BaseController {
${methodBodies}
}
`;
  }
}

// ── make:migration ────────────────────────────────────────

/**
 * CLI command `make:migration` — prints a timestamped migration module using `Schema` from `@carpentry/formworks/orm`.
 *
 * @example
 * ```ts
 * import { CliApp, MakeMigrationCommand } from '@carpentry/cli';
 * await new CliApp().register(new MakeMigrationCommand()).run(['make:migration', 'create_posts_table', '--create', 'posts']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeMigrationCommand extends GeneratorCommand {
  name = "make:migration";
  description = "Generate a new database migration";
  protected templateName = "Migration";
  protected outputDir = "src/database/migrations";

  constructor() {
    super();
    this.option("create", "Table to create", "string");
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
    const name = args.name;
    if (!name) {
      output.error("Name is required.");
      return 1;
    }

    const table = (options.create as string) ?? name.replace(/^create_/, "").replace(/_table$/, "");
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const fileName = `${timestamp}_${name}`;
    const content = this.createTableTemplate(name, table);

    output.success(`Created Migration: ${this.outputDir}/${fileName}.ts`);
    output.info(content);
    return 0;
  }

  protected generateTemplate(name: string): string {
    return this.createTableTemplate(name, name);
  }

  private createTableTemplate(name: string, table: string): string {
    return `import { Schema } from '@carpentry/formworks/orm';
import type { MigrationClass } from '@carpentry/formworks/orm';

const migration: MigrationClass = {
  name: '${name}',

  /**
   * @param {Schema} schema
   */
  async up(schema: Schema) {
    await schema.create('${table}', (table) => {
      table.id();
      // Add columns here
      table.timestamps();
    });
  },

  /**
   * @param {Schema} schema
   */
  async down(schema: Schema) {
    await schema.dropIfExists('${table}');
  },
};

export default migration;
`;
  }
}

// ── make:middleware ────────────────────────────────────────

/**
 * CLI command `make:middleware` — scaffolds an `IMiddleware` implementation for `@carpentry/formworks/core`.
 *
 * @example
 * ```ts
 * import { CliApp, MakeMiddlewareCommand } from '@carpentry/cli';
 * await new CliApp().register(new MakeMiddlewareCommand()).run(['make:middleware', 'AuthMiddleware']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeMiddlewareCommand extends GeneratorCommand {
  name = "make:middleware";
  description = "Generate a new HTTP middleware";
  protected templateName = "Middleware";
  protected outputDir = "src/middleware";

  protected generateTemplate(name: string): string {
    return `import type { IMiddleware, IRequest, NextFunction } from '@carpentry/formworks/core';

export class ${name} implements IMiddleware {
  /**
   * @param {IRequest} request
   * @param {NextFunction} next
   */
  async handle(request: IRequest, next: NextFunction) {
    // Before request...
    const response = await next();
    // After request...
    return response;
  }
}
`;
  }
}

// ── make:notification ─────────────────────────────────────

/**
 * CLI command `make:notification` — scaffolds a mail/database notification class.
 *
 * @example
 * ```ts
 * import { CliApp, MakeNotificationCommand } from '@carpentry/cli';
 * await new CliApp().register(new MakeNotificationCommand()).run(['make:notification', 'InvoicePaid']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeNotificationCommand extends GeneratorCommand {
  name = "make:notification";
  description = "Generate a new notification class";
  protected templateName = "Notification";
  protected outputDir = "src/notifications";

  protected generateTemplate(name: string): string {
    return `import { BaseNotification } from '@carpentry/formworks/notifications';
import type { Notifiable, MailChannelMessage } from '@carpentry/formworks/notifications';

interface ${name}Data {
  // Define your notification data here
}

export class ${name} extends BaseNotification<${name}Data> {
  via(_notifiable: Notifiable) {
    return ['mail', 'database'];
  }

  /**
   * @param {Notifiable} notifiable
   * @returns {MailChannelMessage}
   */
  toMail(notifiable: Notifiable): MailChannelMessage {
    return {
      to: [{ email: notifiable.routeNotificationFor('mail')! }],
      subject: '${name}',
      html: '<p>Notification content here</p>',
    };
  }

  toDatabase() {
    return { type: '${name
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .slice(1)}', data: this.data as Record<string, unknown>, readAt: null };
  }
}
`;
  }
}

// ── make:job ──────────────────────────────────────────────

/**
 * CLI command `make:job` — scaffolds a `BaseJob` subclass for `@carpentry/formworks/queue`.
 *
 * @example
 * ```ts
 * import { CliApp, MakeJobCommand } from '@carpentry/cli';
 * await new CliApp().register(new MakeJobCommand()).run(['make:job', 'SendWelcomeEmail']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeJobCommand extends GeneratorCommand {
  name = "make:job";
  description = "Generate a new queue job class";
  protected templateName = "Job";
  protected outputDir = "src/jobs";

  protected generateTemplate(name: string): string {
    return `import { BaseJob } from '@carpentry/formworks/queue';

interface ${name}Payload {
  // Define your job payload here
}

export class ${name} extends BaseJob<${name}Payload> {
  static queue = 'default';
  static maxTries = 3;

  /**
   * @param {${name}Payload} payload
   */
  async handle(payload: ${name}Payload) {
    // Process the job here
  }

  /**
   * @param {${name}Payload} payload
   * @param {Error} error
   */
  failed(payload: ${name}Payload, error: Error) {
    console.error(\`Job ${name} failed:\`, error.message);
  }
}
`;
  }
}

// ── make:test ─────────────────────────────────────────────

/**
 * CLI command `make:test` — emits a Vitest `describe` block under `tests/`.
 *
 * @example
 * ```ts
 * import { CliApp, MakeTestCommand } from '@carpentry/cli';
 * await new CliApp().register(new MakeTestCommand()).run(['make:test', 'UserService']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeTestCommand extends GeneratorCommand {
  name = "make:test";
  description = "Generate a new test file";
  protected templateName = "Test";
  protected outputDir = "tests";

  protected generateTemplate(name: string): string {
    return `import { describe, it, expect, beforeEach } from 'vitest';

describe('${name}', () => {
  /**
   * @param {unknown} (
   */
  beforeEach(() => {
    // Setup
  });

  /**
   * @param {unknown} 'should work'
   * @param {unknown} (
   */
  it('should work', () => {
    expect(true).toBe(true);
  });
});
`;
  }
}

// ── serve ─────────────────────────────────────────────────

/**
 * CLI command `serve` — placeholder dev-server message (wire to your HTTP entry in a real app).
 *
 * @example
 * ```ts
 * import { CliApp, ServeCommand } from '@carpentry/cli';
 * await new CliApp().register(new ServeCommand()).run(['serve', '--port', '4000']);
 * ```
 *
 * @see BaseCommand
 */
export class ServeCommand extends BaseCommand {
  name = "serve";
  description = "Start the development server";

  constructor() {
    super();
    this.option("port", "Port to listen on", "number");
    this.shortOption("host", "H", "Host to bind to", "string");
    this.option("watch", "Watch for file changes", "boolean");
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
    const port = (options.port as number) ?? 3000;
    const host = (options.host as string) ?? "localhost";
    const watch = options.watch as boolean;

    output.info("🪚 Carpenter dev server starting...");
    output.info(`   Listening on http://${host}:${port}`);
    if (watch) output.info("   File watching enabled");
    output.success("Server ready!");
    return 0;
  }
}

// ── migrate ───────────────────────────────────────────────

/**
 * CLI command `migrate` — demonstrates migration/rollback/seed messaging (connect to ORM in production).
 *
 * @example
 * ```ts
 * import { CliApp, MigrateRunCommand } from '@carpentry/cli';
 * await new CliApp().register(new MigrateRunCommand()).run(['migrate', '--seed']);
 * ```
 *
 * @see BaseCommand
 */
export class MigrateRunCommand extends BaseCommand {
  name = "migrate";
  description = "Run pending database migrations";

  constructor() {
    super();
    this.option("seed", "Run seeders after migration", "boolean");
    this.option("fresh", "Drop all tables and re-run migrations", "boolean");
    this.option("rollback", "Rollback the last batch of migrations", "boolean");
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
    if (options.fresh) {
      output.warn("Dropping all tables...");
      output.info("Re-running all migrations...");
    } else if (options.rollback) {
      output.info("Rolling back last migration batch...");
    } else {
      output.info("Running pending migrations...");
    }

    output.success("Migrations complete.");
    if (options.seed) {
      output.info("Running seeders...");
      output.success("Seeding complete.");
    }
    return 0;
  }
}

// ── generate:service ─────────────────────────────────────

import { generateTypeScript, parseProto } from "./generators/ServiceGenerator.js";

/**
 * CLI command `generate:service` — reads a `.proto` service-definition file and writes
 * TypeScript interface, client stub, and server handler scaffold to disk.
 *
 * @example
 * ```bash
 * carpenter generate:service services/users.proto
 * # Writes:
 * #   src/services/userservice/IUserService.ts
 * #   src/services/userservice/UserServiceClient.ts
 * #   src/services/userservice/UserServiceHandler.ts
 * ```
 *
 * @example
 * ```bash
 * carpenter generate:service services/users.proto --out generated/services
 * ```
 */
export class GenerateServiceCommand extends BaseCommand {
  name = "generate:service";
  description = "Generate a TypeScript interface, client stub, and handler from a .proto file";

  constructor() {
    super();
    this.argument("file", "Path to the .proto service definition file");
    this.option("out", "Output directory for generated files (default: src/services)", "string");
  }

  /**
   * @param {Record<string, string>} args
   * @param {Record<string, unknown>} options
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    args: Record<string, string>,
    options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const filePath = args.file;
    if (!filePath) {
      output.error("File path is required. Usage: carpenter generate:service <file.proto>");
      return 1;
    }

    let source: string;
    try {
      const { readFileSync } = await import("node:fs");
      source = readFileSync(filePath, "utf-8");
    } catch {
      output.error(`Cannot read file: ${filePath}`);
      return 1;
    }

    const { services, messages } = parseProto(source);
    if (services.length === 0) {
      output.error("No service definitions found in the proto file.");
      return 1;
    }

    const outDir = (options.out as string | undefined) ?? "src/services";
    const svc = services[0];
    const serviceDir = `${outDir}/${svc.name.toLowerCase()}`;
    const code = generateTypeScript(services, messages);

    try {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync(serviceDir, { recursive: true });

      const interfaceFile = `${serviceDir}/I${svc.name}.ts`;
      const clientFile = `${serviceDir}/${svc.name}Client.ts`;
      const handlerFile = `${serviceDir}/${svc.name}Handler.ts`;

      writeFileSync(interfaceFile, code.interface, "utf-8");
      writeFileSync(clientFile, code.client, "utf-8");
      writeFileSync(handlerFile, code.handler, "utf-8");

      output.success(`Generated ${svc.name} service files:`);
      output.info(`  ${interfaceFile}`);
      output.info(`  ${clientFile}`);
      output.info(`  ${handlerFile}`);
    } catch (err) {
      output.error(
        `Failed to write output files: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 1;
    }

    return 0;
  }
}

// ── Register all built-in commands ────────────────────────

import {
  DbSeedCommand,
  MakeEventCommand,
  MakeFactoryCommand,
  MakeListenerCommand,
  MakeProviderCommand,
  MakeRequestCommand,
  MakeSeederCommand,
  ScheduleRunCommand,
} from "./additional-commands.js";

import {
  DoctorCommand,
  InspectContainerCommand,
  InspectRoutesCommand,
} from "./inspect-commands.js";

import { TenantCreateCommand, TenantListCommand, TenantMigrateCommand } from "./tenant-commands.js";

import {
  AddFeatureCommand,
  ListFeaturesCommand,
  RemoveFeatureCommand,
} from "./feature-commands.js";
import { RoutesGenerateCommand } from "./routes-commands.js";
import { UpgradeCheckCommand } from "./migration-guide.js";
import { SecurityAuditCommand } from "./security-audit.js";

/**
 * Registers scaffold, diagnostic, tenant, security, upgrade, and feature commands on any object
 * with `register(cmd)` (typically `CliApp` from this package).
 *
 * @example
 * ```ts
 * import { CliApp, registerBuiltinCommands } from '@carpentry/cli';
 *
 * const app = new CliApp();
 * registerBuiltinCommands(app);
 * await app.run(process.argv.slice(2));
 * ```
 *
 * @param app Host with `register(command)` returning unknown (chain-friendly)
 */
export function registerBuiltinCommands(app: { register(cmd: BaseCommand): unknown }): void {
  app.register(new NewAppCommand());
  app.register(new MakeModelCommand());
  app.register(new MakeControllerCommand());
  app.register(new MakeMigrationCommand());
  app.register(new MakeMiddlewareCommand());
  app.register(new MakeNotificationCommand());
  app.register(new MakeJobCommand());
  app.register(new MakeTestCommand());
  app.register(new MakeFactoryCommand());
  app.register(new MakeSeederCommand());
  app.register(new MakeEventCommand());
  app.register(new MakeListenerCommand());
  app.register(new MakeRequestCommand());
  app.register(new MakeProviderCommand());
  app.register(new ServeCommand());
  app.register(new MigrateRunCommand());
  app.register(new DbSeedCommand());
  app.register(new ScheduleRunCommand());
  app.register(new InspectRoutesCommand());
  app.register(new InspectContainerCommand());
  app.register(new DoctorCommand());
  app.register(new TenantCreateCommand());
  app.register(new TenantMigrateCommand());
  app.register(new TenantListCommand());
  app.register(new SecurityAuditCommand());
  app.register(new UpgradeCheckCommand());
  app.register(new AddFeatureCommand());
  app.register(new RemoveFeatureCommand());
  app.register(new ListFeaturesCommand());
  app.register(new RoutesGenerateCommand());
  app.register(new GenerateServiceCommand());
}
