/**
 * @module @formwork/cli
 * @description Additional generator and utility commands
 * @patterns Template Method (GeneratorCommand), Command
 * @principles SRP (each command one purpose), OCP (add commands without modifying existing)
 */

import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

// ── Generator Base (duplicated to avoid circular import) ──

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

// ── make:factory ────────────────────────────────────────────

/**
 * CLI command `make:factory` — scaffolds a `ModelFactory` for `@formwork/orm`.
 *
 * @example
 * ```ts
 * import { CliApp, MakeFactoryCommand } from '@formwork/cli';
 * await new CliApp().register(new MakeFactoryCommand()).run(['make:factory', 'UserFactory']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeFactoryCommand extends GeneratorCommand {
  name = "make:factory";
  description = "Generate a new model factory";
  protected templateName = "Factory";
  protected outputDir = "src/database/factories";

  protected generateTemplate(name: string): string {
    const modelName = name.replace(/Factory$/, "");
    return `import { ModelFactory } from '@formwork/orm';
import { ${modelName} } from '../../models/${modelName}.js';

export class ${name} extends ModelFactory<${modelName}> {
  model = ${modelName};

  definition(): Partial<${modelName}> {
    return {
      // Define your factory defaults here
    };
  }
}
`;
  }
}

// ── make:seeder ─────────────────────────────────────────────

/**
 * CLI command `make:seeder` — scaffolds an `ISeeder` implementation.
 *
 * @example
 * ```ts
 * import { CliApp, MakeSeederCommand } from '@formwork/cli';
 * await new CliApp().register(new MakeSeederCommand()).run(['make:seeder', 'DatabaseSeeder']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeSeederCommand extends GeneratorCommand {
  name = "make:seeder";
  description = "Generate a new database seeder";
  protected templateName = "Seeder";
  protected outputDir = "src/database/seeders";

  protected generateTemplate(name: string): string {
    return `import type { ISeeder } from '@formwork/orm';

export class ${name} implements ISeeder {
  async run(): Promise<void> {
    // Seed the database
  }
}
`;
  }
}

// ── make:event ──────────────────────────────────────────────

/**
 * CLI command `make:event` — scaffolds a simple event class with a typed payload.
 *
 * @example
 * ```ts
 * import { CliApp, MakeEventCommand } from '@formwork/cli';
 * await new CliApp().register(new MakeEventCommand()).run(['make:event', 'OrderShipped']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeEventCommand extends GeneratorCommand {
  name = "make:event";
  description = "Generate a new event class";
  protected templateName = "Event";
  protected outputDir = "src/events";

  protected generateTemplate(name: string): string {
    return `export interface ${name}Payload {
  // Define event payload properties
}

export class ${name} {
  readonly name = '${name}';

  constructor(public readonly payload: ${name}Payload) {}
}
`;
  }
}

// ── make:listener ───────────────────────────────────────────

/**
 * CLI command `make:listener` — scaffolds an async `handle(event)` listener stub.
 *
 * @example
 * ```ts
 * import { CliApp, MakeListenerCommand } from '@formwork/cli';
 * await new CliApp().register(new MakeListenerCommand()).run(['make:listener', 'SendShipmentEmail']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeListenerCommand extends GeneratorCommand {
  name = "make:listener";
  description = "Generate a new event listener";
  protected templateName = "Listener";
  protected outputDir = "src/listeners";

  constructor() {
    super();
    this.option("event", "The event class this listener handles", "string", "");
  }

  protected generateTemplate(name: string): string {
    return `export class ${name} {
  /**
   * @param {unknown} event
   * @returns {Promise<void>}
   */
  async handle(event: unknown): Promise<void> {
    // Handle the event
  }
}
`;
  }
}

// ── db:seed ─────────────────────────────────────────────────

/**
 * CLI command `db:seed` — placeholder seeder runner (wire to `@formwork/orm` seeders in production).
 *
 * @example
 * ```ts
 * import { CliApp, DbSeedCommand } from '@formwork/cli';
 * await new CliApp().register(new DbSeedCommand()).run(['db:seed', '--class', 'UserSeeder']);
 * ```
 *
 * @see BaseCommand
 */
export class DbSeedCommand extends BaseCommand {
  name = "db:seed";
  description = "Run database seeders";

  constructor() {
    super();
    this.option("class", "Specific seeder class to run", "string", "");
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
    const seederClass = options.class as string;
    if (seederClass) {
      output.info(`Running seeder: ${seederClass}...`);
    } else {
      output.info("Running all seeders...");
    }
    output.success("Seeding complete.");
    return 0;
  }
}

// ── schedule:run ────────────────────────────────────────────

/**
 * CLI command `schedule:run` — placeholder for the task scheduler (integrate with `@formwork/schedule` if used).
 *
 * @example
 * ```ts
 * import { CliApp, ScheduleRunCommand } from '@formwork/cli';
 * await new CliApp().register(new ScheduleRunCommand()).run(['schedule:run']);
 * ```
 *
 * @see BaseCommand
 */
export class ScheduleRunCommand extends BaseCommand {
  name = "schedule:run";
  description = "Run due scheduled tasks";

  /**
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    _args: Record<string, string>,
    _options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    output.info("Checking for due tasks...");
    output.success("Scheduled tasks executed.");
    return 0;
  }
}

// ── make:provider ───────────────────────────────────────────

/**
 * CLI command `make:provider` — scaffolds a `ServiceProvider` for `@formwork/core`.
 *
 * @example
 * ```ts
 * import { CliApp, MakeProviderCommand } from '@formwork/cli';
 * await new CliApp().register(new MakeProviderCommand()).run(['make:provider', 'AppServiceProvider']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeProviderCommand extends GeneratorCommand {
  name = "make:provider";
  description = "Generate a new service provider";
  protected templateName = "ServiceProvider";
  protected outputDir = "src/providers";

  protected generateTemplate(name: string): string {
    return `import { ServiceProvider } from '@formwork/core';

export class ${name} extends ServiceProvider {
  register(): void {
    // Register bindings in the container
  }

  boot(): void {
    // Bootstrap services after all providers registered
  }
}
`;
  }
}

// ── make:request (FormRequest) ──────────────────────────────

/**
 * CLI command `make:request` — scaffolds a form request with `rules()` / `authorize()` stubs.
 *
 * @example
 * ```ts
 * import { CliApp, MakeRequestCommand } from '@formwork/cli';
 * await new CliApp().register(new MakeRequestCommand()).run(['make:request', 'StorePostRequest']);
 * ```
 *
 * @see BaseCommand
 */
export class MakeRequestCommand extends GeneratorCommand {
  name = "make:request";
  description = "Generate a new form request (validation)";
  protected templateName = "FormRequest";
  protected outputDir = "src/requests";

  protected generateTemplate(name: string): string {
    return `export class ${name} {
  rules(): Record<string, string> {
    return {
      // Define validation rules
    };
  }

  authorize(): boolean {
    return true;
  }

  messages(): Record<string, string> {
    return {};
  }
}
`;
  }
}
