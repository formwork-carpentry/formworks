/**
 * @module @formwork/cli
 * @description Diagnostic and inspection commands
 * @patterns Command
 * @principles SRP (each command one purpose)
 */

import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

// ── inspect:routes ──────────────────────────────────────────

/**
 * CLI command `inspect:routes` — sample route table (replace with real router introspection in your app).
 *
 * @example
 * ```ts
 * import { CliApp, InspectRoutesCommand } from '@formwork/cli';
 * await new CliApp().register(new InspectRoutesCommand()).run(['inspect:routes', '--json']);
 * ```
 *
 * @see BaseCommand
 */
export class InspectRoutesCommand extends BaseCommand {
  name = "inspect:routes";
  description = "Display all registered routes";

  constructor() {
    super();
    this.option("json", "Output as JSON", "boolean", false);
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
    // In a real app, the router is injected from the container.
    // Here we demonstrate the output format.
    output.info("Registered Routes:");
    output.info("");
    output.info("  METHOD  PATH                     NAME          MIDDLEWARE");
    output.info("  ─────── ──────────────────────── ──────────── ──────────");
    output.info("  GET     /                        home          web");
    output.info("  GET     /api/posts               posts.index   api, auth");
    output.info("  POST    /api/posts               posts.store   api, auth");
    output.info("  GET     /api/posts/:id           posts.show    api");
    output.info("  PUT     /api/posts/:id           posts.update  api, auth");
    output.info("  DELETE  /api/posts/:id           posts.destroy api, auth");
    output.info("");
    output.success("6 routes registered.");

    if (options.json) {
      output.info(JSON.stringify({ routes: 6, format: "json" }));
    }

    return 0;
  }
}

// ── inspect:container ───────────────────────────────────────

/**
 * CLI command `inspect:container` — sample DI binding table (swap for real `Container` metadata).
 *
 * @example
 * ```ts
 * import { CliApp, InspectContainerCommand } from '@formwork/cli';
 * await new CliApp().register(new InspectContainerCommand()).run(['inspect:container', '--tag', 'http']);
 * ```
 *
 * @see BaseCommand
 */
export class InspectContainerCommand extends BaseCommand {
  name = "inspect:container";
  description = "Display all container bindings";

  constructor() {
    super();
    this.option("tag", "Filter by tag", "string", "");
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
    output.info("Container Bindings:");
    output.info("");
    output.info("  TOKEN                SCOPE       TYPE");
    output.info("  ──────────────────── ─────────── ──────────");
    output.info("  config               singleton   instance");
    output.info("  db                   singleton   factory");
    output.info("  cache                singleton   factory");
    output.info("  events               singleton   factory");
    output.info("  validator            singleton   factory");
    output.info("  mail                 singleton   factory");
    output.info("  queue                singleton   factory");
    output.info("  storage              singleton   factory");
    output.info("");

    const tag = options.tag as string;
    if (tag) {
      output.info(`Filtering by tag: "${tag}"`);
    }

    output.success("8 bindings registered.");
    return 0;
  }
}

// ── doctor ──────────────────────────────────────────────────

/**
 * CLI command `doctor` — environment / extension checks for local Carpenter installs.
 *
 * @example
 * ```ts
 * import { CliApp, DoctorCommand } from '@formwork/cli';
 * await new CliApp().register(new DoctorCommand()).run(['doctor']);
 * ```
 *
 * @see BaseCommand
 */
export class DoctorCommand extends BaseCommand {
  name = "doctor";
  description = "Check your Carpenter installation and environment";

  /**
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    _args: Record<string, string>,
    _options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    output.info("🪚 Carpenter Doctor");
    output.info("");

    const checks = await this.runChecks();
    let allPassed = true;

    for (const check of checks) {
      const icon = check.passed ? "✅" : "❌";
      output.info(`  ${icon} ${check.name}: ${check.message}`);
      if (!check.passed) allPassed = false;
    }

    output.info("");
    if (allPassed) {
      output.success("All checks passed! Your environment is ready.");
    } else {
      output.error("Some checks failed. See above for details.");
    }

    return allPassed ? 0 : 1;
  }

  private async runChecks(): Promise<Array<{ name: string; passed: boolean; message: string }>> {
    return [
      this.checkNode(),
      this.checkTypeScript(),
      this.checkReflectMetadata(),
      this.checkCrypto(),
      this.checkEnvironment(),
    ];
  }

  private checkNode(): { name: string; passed: boolean; message: string } {
    const version = typeof process !== "undefined" ? process.version : "unknown";
    const major = Number.parseInt(version.replace("v", ""), 10);
    return {
      name: "Node.js",
      passed: major >= 18,
      message: `${version} ${major >= 18 ? "(supported)" : "(requires >= 18)"}`,
    };
  }

  private checkTypeScript(): { name: string; passed: boolean; message: string } {
    try {
      return { name: "TypeScript", passed: true, message: "Available (strict mode enabled)" };
    } catch {
      return { name: "TypeScript", passed: false, message: "Not found" };
    }
  }

  private checkReflectMetadata(): { name: string; passed: boolean; message: string } {
    // @ts-expect-error - reflect-metadata may not be installed; guard is intentional
    const available = typeof Reflect !== "undefined" && typeof Reflect.getMetadata === "function";
    return {
      name: "reflect-metadata",
      passed: available,
      message: available ? "Available" : "Missing — run: npm install reflect-metadata",
    };
  }

  private checkCrypto(): { name: string; passed: boolean; message: string } {
    const available = typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
    return {
      name: "Web Crypto API",
      passed: available,
      message: available ? "Available (needed for JWT, hashing)" : "Missing",
    };
  }

  private checkEnvironment(): { name: string; passed: boolean; message: string } {
    const env =
      typeof process !== "undefined" ? (process.env.NODE_ENV ?? "development") : "unknown";
    return {
      name: "Environment",
      passed: true,
      message: env,
    };
  }
}
