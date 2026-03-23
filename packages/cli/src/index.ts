/**
 * @module @carpentry/cli
 * @description CLI framework — command registry, argument parsing, help generation
 *
 * @patterns Command (each CLI command), Registry (command lookup), Template Method (BaseCommand),
 *           Builder (argument/option definition)
 * @principles OCP — new commands via register; SRP — parsing, execution, output are separate
 *
 * @example
 * ```ts
 * import { BaseCommand, CliApp } from '@carpentry/cli';
 *
 * class HelloCommand extends BaseCommand {
 *   name = 'hello';
 *   description = 'Print a greeting';
 *
 *   constructor() {
 *     super();
 *     this.argument('name', 'Name to greet');
 *     this.option('shout', 'Uppercase the greeting', 'boolean', false);
 *   }
 *
 *   async handle(args: Record<string, string>, options: Record<string, unknown>) {
 *     const name = args.name ?? 'world';
 *     const msg = `Hello, ${name}!`;
 *     const out = options.shout ? msg.toUpperCase() : msg;
 *     // CommandOutput is provided by CliApp; you can also use ConsoleOutput directly.
 *     return 0;
 *   }
 * }
 *
 * const app = new CliApp().register(new HelloCommand());
 * await app.run(['hello', 'Alice', '--shout']);
 * ```
 */

// ── Types ─────────────────────────────────────────────────

export interface CommandArgument {
  name: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
}

export interface CommandOption {
  name: string;
  short?: string;
  description: string;
  type: "string" | "boolean" | "number";
  defaultValue?: unknown;
  required?: boolean;
}

export interface ParsedInput {
  command: string;
  args: Record<string, string>;
  options: Record<string, unknown>;
}

export interface CommandOutput {
  /**
   * @param {string} message
   */
  info(message: string): void;
  /**
   * @param {string} message
   */
  error(message: string): void;
  /**
   * @param {string} message
   */
  warn(message: string): void;
  /**
   * @param {string} message
   */
  success(message: string): void;
  /**
   * @param {string[]} headers
   * @param {string[][]} rows
   */
  table(headers: string[], rows: string[][]): void;
  newLine(): void;
}

// ── BaseCommand ───────────────────────────────────────────

/**
 * Base class for Carpenter CLI commands: define `name`, `description`, arguments/options in the
 * constructor, then implement {@link BaseCommand.handle}. Used with {@link CliApp} and {@link CommandRegistry}.
 *
 * @example
 * ```ts
 * import { BaseCommand, CliApp, type CommandOutput } from '@carpentry/cli';
 *
 * class PingCommand extends BaseCommand {
 *   name = 'ping';
 *   description = 'Health check';
 *   constructor() {
 *     super();
 *   }
 *   async handle(_args, _opts, out: CommandOutput) {
 *     out.success('pong');
 *     return 0;
 *   }
 * }
 *
 * await new CliApp().register(new PingCommand()).run(['ping']);
 * ```
 *
 * @see CliApp
 * @see CommandRegistry
 */
export abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  protected arguments: CommandArgument[] = [];
  protected options: CommandOption[] = [];

  /** Define arguments (call in constructor or override) */
  /**
   * @param {string} name
   * @param {string} description
   * @param {boolean} [required]
   * @param {string} [defaultValue]
   * @returns {this}
   */
  argument(name: string, description: string, required = true, defaultValue?: string): this {
    this.arguments.push({ name, description, required, defaultValue });
    return this;
  }

  /** Define options */
  /**
   * @param {string} name
   * @param {string} description
   * @param {'string' | 'boolean' | 'number'} [type]
   * @param {unknown} [defaultValue]
   * @returns {this}
   */
  option(
    name: string,
    description: string,
    type: "string" | "boolean" | "number" = "string",
    defaultValue?: unknown,
  ): this {
    this.options.push({ name, description, type, defaultValue });
    return this;
  }

  /** Short option alias */
  /**
   * @param {string} name
   * @param {string} short
   * @param {string} description
   * @param {'string' | 'boolean' | 'number'} [type]
   * @returns {this}
   */
  shortOption(
    name: string,
    short: string,
    description: string,
    type: "string" | "boolean" | "number" = "string",
  ): this {
    this.options.push({ name, short, description, type });
    return this;
  }

  /** Override this to implement command logic */
  abstract handle(
    args: Record<string, string>,
    options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number>;

  getArguments(): CommandArgument[] {
    return [...this.arguments];
  }
  getOptions(): CommandOption[] {
    return [...this.options];
  }
}

// ── InMemoryConsole — captures output for testing ─────────

/**
 * {@link CommandOutput} implementation that records lines for tests — no real stdout.
 * Use `getOutput()`, `assertOutputContains()`, and `assertNoErrors()` in Vitest-style suites.
 *
 * @example
 * ```ts
 * import { InMemoryConsole, CliApp, BaseCommand, type CommandOutput } from '@carpentry/cli';
 *
 * class HiCommand extends BaseCommand {
 *   name = 'hi';
 *   description = 'Say hi';
 *   async handle(_a, _o, out: CommandOutput) {
 *     out.info('hello');
 *     return 0;
 *   }
 * }
 *
 * const mem = new InMemoryConsole();
 * await new CliApp(undefined, mem).register(new HiCommand()).run(['hi'], mem);
 * mem.assertOutputContains('hello');
 * ```
 *
 * @see CommandOutput
 */
export class InMemoryConsole implements CommandOutput {
  private lines: Array<{ type: "info" | "error" | "warn" | "success" | "table"; content: string }> =
    [];

  /**
   * @param {string} message
   */
  info(message: string): void {
    this.lines.push({ type: "info", content: message });
  }
  /**
   * @param {string} message
   */
  error(message: string): void {
    this.lines.push({ type: "error", content: message });
  }
  /**
   * @param {string} message
   */
  warn(message: string): void {
    this.lines.push({ type: "warn", content: message });
  }
  /**
   * @param {string} message
   */
  success(message: string): void {
    this.lines.push({ type: "success", content: message });
  }
  /**
   * @param {string[]} headers
   * @param {string[][]} rows
   */
  table(headers: string[], rows: string[][]): void {
    const headerLine = headers.join(" | ");
    const rowLines = rows.map((r) => r.join(" | "));
    this.lines.push({ type: "table", content: [headerLine, ...rowLines].join("\n") });
  }
  newLine(): void {
    this.lines.push({ type: "info", content: "" });
  }

  // ── Test helpers ──────────────────────────────────────

  all(): typeof this.lines {
    return [...this.lines];
  }
  count(): number {
    return this.lines.length;
  }
  getOutput(): string {
    return this.lines.map((l) => l.content).join("\n");
  }
  getErrors(): string[] {
    return this.lines.filter((l) => l.type === "error").map((l) => l.content);
  }

  /**
   * @param {string} fragment
   */
  assertOutputContains(fragment: string): void {
    const output = this.getOutput();
    if (!output.includes(fragment)) {
      throw new Error(`Expected output to contain "${fragment}".\nActual:\n${output}`);
    }
  }

  /**
   * @param {string} fragment
   */
  assertOutputNotContains(fragment: string): void {
    if (this.getOutput().includes(fragment)) {
      throw new Error(`Expected output NOT to contain "${fragment}".`);
    }
  }

  assertNoErrors(): void {
    const errors = this.getErrors();
    if (errors.length > 0) throw new Error(`Expected no errors, but found: ${errors.join(", ")}`);
  }

  /**
   * @param {string} [fragment]
   */
  assertHasError(fragment?: string): void {
    const errors = this.getErrors();
    if (errors.length === 0) throw new Error("Expected at least one error, but none found.");
    if (fragment && !errors.some((e) => e.includes(fragment))) {
      throw new Error(`Expected error containing "${fragment}". Errors: ${errors.join(", ")}`);
    }
  }

  reset(): void {
    this.lines = [];
  }
}

// ── Argument Parser ───────────────────────────────────────

/**
 * Parses positional tokens and `--flag` / `-f` options from `argv` (usually everything after the command name).
 * Boolean flags default to `false` until present; values can use `--key=value` or `--key value`.
 *
 * @param argv Raw tokens (no command name)
 * @param argDefs Positional argument definitions from the command
 * @param optDefs Option definitions from the command
 * @returns Parsed `args` map and `options` map
 *
 * @example
 * ```ts
 * import { parseArgv } from '@carpentry/cli';
 *
 * const argDefs = [{ name: 'slug', description: 'Tenant', required: true }];
 * const optDefs = [{ name: 'verbose', description: 'Log', type: 'boolean' as const, defaultValue: false }];
 * const { args, options } = parseArgv(['acme', '--verbose'], argDefs, optDefs);
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: CLI argument parsing requires multiple type-specific branches
export function parseArgv(
  argv: string[],
  argDefs: CommandArgument[],
  optDefs: CommandOption[],
): { args: Record<string, string>; options: Record<string, unknown> } {
  const args: Record<string, string> = {};
  const options: Record<string, unknown> = {};
  const positionalArgs: string[] = [];

  // Set defaults
  /**
   * @param {unknown} const opt of optDefs
   */
  for (const opt of optDefs) {
    if (opt.defaultValue !== undefined) options[opt.name] = opt.defaultValue;
    if (opt.type === "boolean" && options[opt.name] === undefined) options[opt.name] = false;
  }
  /**
   * @param {unknown} const arg of argDefs
   */
  for (const arg of argDefs) {
    if (arg.defaultValue !== undefined) args[arg.name] = arg.defaultValue;
  }

  let i = 0;
  /**
   * @param {unknown} i < argv.length
   */
  while (i < argv.length) {
    const token = argv[i];

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const [name, inlineValue] = key.split("=");
      const opt = optDefs.find((o) => o.name === name);

      if (opt?.type === "boolean") {
        options[name] = inlineValue !== undefined ? inlineValue !== "false" : true;
      } else if (inlineValue !== undefined) {
        options[name] = opt?.type === "number" ? Number(inlineValue) : inlineValue;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        i++;
        options[name] = opt?.type === "number" ? Number(argv[i]) : argv[i];
      } else {
        options[name] = true;
      }
    } else if (token.startsWith("-") && token.length === 2) {
      const short = token.slice(1);
      const opt = optDefs.find((o) => o.short === short);
      const name = opt?.name ?? short;

      if (opt?.type === "boolean") {
        options[name] = true;
      } else if (i + 1 < argv.length) {
        i++;
        options[name] = opt?.type === "number" ? Number(argv[i]) : argv[i];
      }
    } else {
      positionalArgs.push(token);
    }
    i++;
  }

  // Map positional args
  /**
   * @param {unknown} [let j = 0; j < argDefs.length && j < positionalArgs.length; j++]
   */
  for (let j = 0; j < argDefs.length && j < positionalArgs.length; j++) {
    args[argDefs[j].name] = positionalArgs[j];
  }

  return { args, options };
}

// ── Command Registry ──────────────────────────────────────

/**
 * In-memory map of command name → {@link BaseCommand}, plus `help` / `helpAll` text for `--help`.
 * Typically owned by {@link CliApp}; you can also use it standalone for custom runners.
 *
 * @example
 * ```ts
 * import { CommandRegistry, BaseCommand, type CommandOutput } from '@carpentry/cli';
 *
 * class VersionCommand extends BaseCommand {
 *   name = 'version';
 *   description = 'Show version';
 *   async handle(_a, _o, out: CommandOutput) {
 *     out.info('1.0.0');
 *     return 0;
 *   }
 * }
 *
 * const reg = new CommandRegistry().register(new VersionCommand());
 * console.log(reg.help('version'));
 * ```
 *
 * @see CliApp
 */
export class CommandRegistry {
  private commands = new Map<string, BaseCommand>();

  /**
   * @param {BaseCommand} command
   * @returns {this}
   */
  register(command: BaseCommand): this {
    this.commands.set(command.name, command);
    return this;
  }

  /**
   * @param {string} name
   * @returns {BaseCommand | undefined}
   */
  get(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  all(): BaseCommand[] {
    return [...this.commands.values()];
  }

  names(): string[] {
    return [...this.commands.keys()];
  }

  /** Generate help text for a command */
  /**
   * @param {string} name
   * @returns {string}
   */
  help(name: string): string {
    const cmd = this.commands.get(name);
    if (!cmd) return `Unknown command: ${name}`;

    const lines: string[] = [];
    lines.push(`${cmd.name} — ${cmd.description}`);
    lines.push("");

    const args = cmd.getArguments();
    if (args.length > 0) {
      lines.push("Arguments:");
      for (const arg of args) {
        lines.push(`  ${arg.name}${arg.required ? "" : " (optional)"}  ${arg.description}`);
      }
      lines.push("");
    }

    const opts = cmd.getOptions();
    if (opts.length > 0) {
      lines.push("Options:");
      for (const opt of opts) {
        const flag = opt.short ? `-${opt.short}, --${opt.name}` : `    --${opt.name}`;
        lines.push(`  ${flag}  ${opt.description}`);
      }
    }

    return lines.join("\n");
  }

  /** Generate list of all commands */
  helpAll(): string {
    const lines = ["Available commands:", ""];
    const maxLen = Math.max(...[...this.commands.keys()].map((k) => k.length));
    for (const [name, cmd] of this.commands) {
      lines.push(`  ${name.padEnd(maxLen + 2)}${cmd.description}`);
    }
    return lines.join("\n");
  }
}

// ── CLI Application ───────────────────────────────────────

/**
 * Thin CLI host: resolves the first argv token to a registered {@link BaseCommand}, parses options via
 * {@link parseArgv}, and invokes `handle` with a {@link CommandOutput} (defaults to {@link ConsoleOutput}).
 *
 * @example
 * ```ts
 * import { CliApp, BaseCommand, type CommandOutput } from '@carpentry/cli';
 *
 * class EchoCommand extends BaseCommand {
 *   name = 'echo';
 *   description = 'Echo text';
 *   constructor() {
 *     super();
 *     this.argument('text', 'Text to print');
 *   }
 *   async handle(args, _opts, out: CommandOutput) {
 *     out.info(args.text ?? '');
 *     return 0;
 *   }
 * }
 *
 * const code = await new CliApp().register(new EchoCommand()).run(['echo', 'hi']);
 * ```
 *
 * @see CommandRegistry
 * @see parseArgv
 */
export class CliApp {
  private registry: CommandRegistry;
  private defaultOutput: CommandOutput;

  constructor(registry?: CommandRegistry, output?: CommandOutput) {
    this.registry = registry ?? new CommandRegistry();
    this.defaultOutput = output ?? new ConsoleOutput();
  }

  /**
   * @param {BaseCommand} command
   * @returns {this}
   */
  register(command: BaseCommand): this {
    this.registry.register(command);
    return this;
  }

  /** Run a command from raw argv */
  /**
   * @param {string[]} argv
   * @param {CommandOutput} [output]
   * @returns {Promise<number>}
   */
  async run(argv: string[], output?: CommandOutput): Promise<number> {
    const out = output ?? this.defaultOutput;

    if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help") {
      out.info(this.registry.helpAll());
      return 0;
    }

    const command = this.registry.get(argv[0]);
    if (!command) {
      out.error(`Unknown command: ${argv[0]}`);
      out.info(`Run "help" to see available commands.`);
      return 1;
    }

    if (argv.includes("--help")) {
      out.info(this.registry.help(argv[0]));
      return 0;
    }

    return this.executeCommand(command, argv.slice(1), out);
  }

  private async executeCommand(
    command: BaseCommand,
    rawArgs: string[],
    out: CommandOutput,
  ): Promise<number> {
    const { args, options } = parseArgv(rawArgs, command.getArguments(), command.getOptions());

    for (const argDef of command.getArguments()) {
      if (argDef.required && !args[argDef.name]) {
        out.error(`Missing required argument: ${argDef.name}`);
        return 1;
      }
    }

    try {
      return await command.handle(args, options, out);
    } catch (error) {
      out.error(`Command failed: ${(error as Error).message}`);
      return 1;
    }
  }

  getRegistry(): CommandRegistry {
    return this.registry;
  }
}

// ── Console Output (real terminal) ────────────────────────

/**
 * Default {@link CommandOutput} that writes to `console` with simple prefixes and ASCII tables.
 * Pass an instance to {@link CliApp} when you do not need {@link InMemoryConsole}.
 *
 * @example
 * ```ts
 * import { CliApp, ConsoleOutput, BaseCommand, type CommandOutput } from '@carpentry/cli';
 *
 * class OkCommand extends BaseCommand {
 *   name = 'ok';
 *   description = 'Done';
 *   async handle(_a, _o, out: CommandOutput) {
 *     out.success('ready');
 *     return 0;
 *   }
 * }
 *
 * await new CliApp(undefined, new ConsoleOutput()).register(new OkCommand()).run(['ok']);
 * ```
 *
 * @see InMemoryConsole
 */
export class ConsoleOutput implements CommandOutput {
  /**
   * @param {string} message
   */
  info(message: string): void {
    console.log(message);
  }
  /**
   * @param {string} message
   */
  error(message: string): void {
    console.error(`ERROR: ${message}`);
  }
  /**
   * @param {string} message
   */
  warn(message: string): void {
    console.warn(`WARN: ${message}`);
  }
  /**
   * @param {string} message
   */
  success(message: string): void {
    console.log(`✓ ${message}`);
  }
  /**
   * @param {string[]} headers
   * @param {string[][]} rows
   */
  table(headers: string[], rows: string[][]): void {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
    );
    const line = headers.map((h, i) => h.padEnd(widths[i])).join(" | ");
    const sep = widths.map((w) => "-".repeat(w)).join("-+-");
    console.log(line);
    console.log(sep);
    for (const row of rows) {
      console.log(row.map((c, i) => (c ?? "").padEnd(widths[i])).join(" | "));
    }
  }
  newLine(): void {
    console.log("");
  }
}

export { DevServer } from "./DevServer.js";
export type { DevServerConfig, DevServerState } from "./DevServer.js";
export { parseProto, generateTypeScript } from "./generators/ServiceGenerator.js";
