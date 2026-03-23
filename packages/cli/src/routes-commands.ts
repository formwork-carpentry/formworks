import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateRouteGaugerFiles } from "@carpentry/http";
import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

interface RouterLike {
  getRoutes(): unknown[];
}

export class RoutesGenerateCommand extends BaseCommand {
  name = "routes:generate";
  description = "Generate frontend route gauger modules from backend named routes";

  constructor() {
    super();
    this.option("input", "Path to app module exporting createApp", "string", "src/app.ts");
    this.option("export", "Factory export name", "string", "createApp");
    this.option("output", "Output directory for generated route modules", "string", "src/routes/generated");
    this.option("skip-env", "Pass skipEnv=true to createApp when supported", "boolean", false);
  }

  async handle(
    _args: Record<string, string>,
    options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const input = String(options.input ?? "src/app.ts");
    const exportName = String(options.export ?? "createApp");
    const outDir = String(options.output ?? "src/routes/generated");
    const skipEnv = options["skip-env"] === true;

    const modulePath = resolve(process.cwd(), input);
    const moduleUrl = pathToFileURL(modulePath).href;

    let loaded: Record<string, unknown>;
    try {
      loaded = await import(moduleUrl) as Record<string, unknown>;
    } catch (error) {
      output.error(`Failed to load module ${input}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }

    const factory = loaded[exportName];
    if (typeof factory !== "function") {
      output.error(`Export \"${exportName}\" is not a function in ${input}.`);
      return 1;
    }

    let appResult: unknown;
    try {
      appResult = await (factory as (options?: { skipEnv?: boolean }) => Promise<unknown>)({ skipEnv });
    } catch (error) {
      output.error(`Failed to execute ${exportName}(): ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }

    const router = resolveRouter(appResult);
    if (!router) {
      output.error(`Could not find a router with getRoutes() in ${exportName}() result.`);
      return 1;
    }

    const files = generateRouteGaugerFiles(router.getRoutes() as never[]);
    const outputPath = resolve(process.cwd(), outDir);
    await mkdir(outputPath, { recursive: true });

    for (const file of files) {
      await writeFile(resolve(outputPath, file.fileName), file.code, "utf8");
    }

    output.success(`Generated ${files.length} route gauger file(s) in ${outDir}.`);
    return 0;
  }
}

function resolveRouter(value: unknown): RouterLike | null {
  if (isRouterLike(value)) {
    return value;
  }

  if (value && typeof value === "object" && "router" in value) {
    const maybeRouter = (value as { router?: unknown }).router;
    if (isRouterLike(maybeRouter)) {
      return maybeRouter;
    }
  }

  return null;
}

function isRouterLike(value: unknown): value is RouterLike {
  return typeof value === "object"
    && value !== null
    && "getRoutes" in value
    && typeof (value as { getRoutes?: unknown }).getRoutes === "function";
}
