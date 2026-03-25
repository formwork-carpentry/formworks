import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { CarpenterModuleManager, resolveModulePaths } from "../src/index.js";

describe("@carpentry/modular", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(resolve(tmpdir(), "carpenter-modules-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("discovers modules from a Laravel-style Modules tree", async () => {
    const modulesRoot = resolve(root, "Modules");
    const blogRoot = resolve(modulesRoot, "Blog");

    await mkdir(blogRoot, { recursive: true });
    await writeFile(
      resolve(blogRoot, "module.json"),
      JSON.stringify({ name: "Blog", enabled: true, entry: "module.js", priority: 10 }),
      "utf8",
    );
    await writeFile(
      resolve(blogRoot, "module.js"),
      "export default { name: 'Blog', priority: 10 }",
      "utf8",
    );

    const moduleManager = new CarpenterModuleManager({ modulesRoot });
    const modules = await moduleManager.discover();

    expect(modules).toHaveLength(1);
    expect(modules[0]?.definition.name).toBe("Blog");
    expect(modules[0]?.paths.providers.endsWith("/Blog/Providers")).toBe(true);
  });

  it("registers providers and lifecycle hooks for discovered modules", async () => {
    const modulesRoot = resolve(root, "Modules");
    const crmRoot = resolve(modulesRoot, "Crm");

    await mkdir(crmRoot, { recursive: true });
    await writeFile(
      resolve(crmRoot, "module.json"),
      JSON.stringify({ name: "Crm", enabled: true, entry: "module.js" }),
      "utf8",
    );

    await writeFile(
      resolve(crmRoot, "module.js"),
      `
      let registerProviderCalls = 0;
      let bootProviderCalls = 0;
      let registerHookCalls = 0;
      let bootHookCalls = 0;

      class CrmProvider {
        constructor(_app) {}
        register() { registerProviderCalls += 1; }
        async boot() { bootProviderCalls += 1; }
      }

      export default {
        name: 'Crm',
        providers: [CrmProvider],
        register() { registerHookCalls += 1; },
        async boot() { bootHookCalls += 1; }
      };

      export const counters = () => ({
        registerProviderCalls,
        bootProviderCalls,
        registerHookCalls,
        bootHookCalls,
      });
      `,
      "utf8",
    );

    const moduleManager = new CarpenterModuleManager({ modulesRoot });
    const modules = await moduleManager.discover();

    await moduleManager.registerAll({} as never, modules);

    const mod = await import(resolve(crmRoot, "module.js"));
    const counters = mod.counters() as Record<string, number>;

    expect(counters.registerProviderCalls).toBe(1);
    expect(counters.bootProviderCalls).toBe(1);
    expect(counters.registerHookCalls).toBe(1);
    expect(counters.bootHookCalls).toBe(1);
  });

  it("builds canonical module paths", () => {
    const paths = resolveModulePaths("/app/Modules/Billing");

    expect(paths.routes).toBe("/app/Modules/Billing/Routes");
    expect(paths.migrations).toBe("/app/Modules/Billing/Database/Migrations");
    expect(paths.views).toBe("/app/Modules/Billing/resources/views");
  });
});
