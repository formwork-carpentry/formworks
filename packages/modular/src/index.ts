/**
 * @module @carpentry/modular
 * @description Laravel-style module manager for Carpenter applications.
 *
 * Enables a nwidart/laravel-modules-like structure:
 * Modules/<ModuleName>/{module.json,module.ts,Http,Providers,Routes,Database,resources,...}
 * and wires discovered modules into the app container lifecycle.
 */

import { access, readdir, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { IContainer, ServiceProvider } from "@carpentry/formworks/contracts/container";

export interface ModulePathMap {
  root: string;
  config: string;
  http: string;
  providers: string;
  routes: string;
  database: string;
  migrations: string;
  seeders: string;
  factories: string;
  resources: string;
  views: string;
  assets: string;
  lang: string;
  tests: string;
}

export interface ModuleManifest {
  name: string;
  description?: string;
  version?: string;
  enabled?: boolean;
  priority?: number;
  entry?: string;
}

export interface CarpenterModuleDefinition {
  name: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  providers?: Array<new (app: IContainer) => ServiceProvider>;
  register?(app: IContainer): void | Promise<void>;
  boot?(app: IContainer): void | Promise<void>;
}

export interface DiscoveredModule {
  definition: CarpenterModuleDefinition;
  manifest: ModuleManifest;
  directory: string;
  entryFile: string;
  paths: ModulePathMap;
}

export interface ModularOptions {
  modulesRoot?: string;
  manifestFileName?: string;
  defaultEntryCandidates?: string[];
}

const DEFAULT_MANIFEST_FILE = "module.json";

const DEFAULT_ENTRY_CANDIDATES = ["module.ts", "module.js", "index.ts", "index.js"];

/**
 * Build canonical Laravel-style paths for a module directory.
 */
export function resolveModulePaths(moduleDirectory: string): ModulePathMap {
  return {
    root: moduleDirectory,
    config: resolve(moduleDirectory, "Config"),
    http: resolve(moduleDirectory, "Http"),
    providers: resolve(moduleDirectory, "Providers"),
    routes: resolve(moduleDirectory, "Routes"),
    database: resolve(moduleDirectory, "Database"),
    migrations: resolve(moduleDirectory, "Database", "Migrations"),
    seeders: resolve(moduleDirectory, "Database", "Seeders"),
    factories: resolve(moduleDirectory, "Database", "Factories"),
    resources: resolve(moduleDirectory, "resources"),
    views: resolve(moduleDirectory, "resources", "views"),
    assets: resolve(moduleDirectory, "resources", "assets"),
    lang: resolve(moduleDirectory, "resources", "lang"),
    tests: resolve(moduleDirectory, "tests"),
  };
}

/**
 * Module manager that discovers and loads modules from a Modules/ folder.
 *
 * @example
 * const modular = new CarpenterModular({ modulesRoot: "./Modules" });
 * const discovered = await modular.discover();
 * await modular.registerAll(appContainer, discovered);
 */
export class CarpenterModular {
  private readonly options: Required<ModularOptions>;

  constructor(options: ModularOptions = {}) {
    this.options = {
      modulesRoot: options.modulesRoot
        ? resolve(options.modulesRoot)
        : resolve(process.cwd(), "Modules"),
      manifestFileName: options.manifestFileName ?? DEFAULT_MANIFEST_FILE,
      defaultEntryCandidates: options.defaultEntryCandidates ?? DEFAULT_ENTRY_CANDIDATES,
    };
  }

  getModulesRoot(): string {
    return this.options.modulesRoot;
  }

  async discover(): Promise<DiscoveredModule[]> {
    const roots = await this.getModuleDirectories();
    const discovered = await Promise.all(roots.map((moduleDirectory) => this.discoverModule(moduleDirectory)));

    return discovered
      .filter((entry): entry is DiscoveredModule => Boolean(entry))
      .sort((a, b) => (a.definition.priority ?? 0) - (b.definition.priority ?? 0) || a.definition.name.localeCompare(b.definition.name));
  }

  async registerAll(app: IContainer, modules: DiscoveredModule[]): Promise<void> {
    for (const moduleItem of modules) {
      if (moduleItem.definition.enabled === false) {
        continue;
      }

      await moduleItem.definition.register?.(app);

      for (const ProviderClass of moduleItem.definition.providers ?? []) {
        const provider = new ProviderClass(app);
        provider.register();
        await provider.boot();
      }

      await moduleItem.definition.boot?.(app);
    }
  }

  private async discoverModule(moduleDirectory: string): Promise<DiscoveredModule | null> {
    const manifest = await this.readManifest(moduleDirectory);
    if (!manifest || manifest.enabled === false) {
      return null;
    }

    const entryFile = await this.resolveEntryFile(moduleDirectory, manifest.entry);
    if (!entryFile) {
      throw new Error(`No module entry file found for module \"${manifest.name}\" in ${moduleDirectory}`);
    }

    const definition = await this.loadDefinition(entryFile, manifest);

    return {
      definition,
      manifest,
      directory: moduleDirectory,
      entryFile,
      paths: resolveModulePaths(moduleDirectory),
    };
  }

  private async getModuleDirectories(): Promise<string[]> {
    const items = await readdir(this.options.modulesRoot, { withFileTypes: true });
    return items.filter((entry) => entry.isDirectory()).map((entry) => resolve(this.options.modulesRoot, entry.name));
  }

  private async readManifest(moduleDirectory: string): Promise<ModuleManifest | null> {
    const manifestPath = resolve(moduleDirectory, this.options.manifestFileName);

    if (!(await exists(manifestPath))) {
      return null;
    }

    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ModuleManifest>;

    if (!parsed.name || typeof parsed.name !== "string") {
      throw new Error(`Invalid module manifest at ${manifestPath}: missing \"name\"`);
    }

    return {
      name: parsed.name,
      description: parsed.description,
      version: parsed.version,
      enabled: parsed.enabled ?? true,
      priority: parsed.priority ?? 0,
      entry: parsed.entry,
    };
  }

  private async resolveEntryFile(moduleDirectory: string, manifestEntry?: string): Promise<string | null> {
    const candidates = [manifestEntry, ...this.options.defaultEntryCandidates].filter(
      (value): value is string => Boolean(value),
    );

    for (const candidate of candidates) {
      const fullPath = resolve(moduleDirectory, candidate);
      if (await exists(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  private async loadDefinition(
    entryFile: string,
    manifest: ModuleManifest,
  ): Promise<CarpenterModuleDefinition> {
    const imported = (await import(pathToFileURL(entryFile).href)) as Record<string, unknown>;

    const maybeDefinition = imported.default ?? imported.module ?? imported.definition;
    if (!maybeDefinition || typeof maybeDefinition !== "object") {
      return {
        name: manifest.name,
        description: manifest.description,
        enabled: manifest.enabled,
        priority: manifest.priority,
      };
    }

    const definition = maybeDefinition as Partial<CarpenterModuleDefinition>;
    if (!definition.name) {
      definition.name = manifest.name;
    }

    return {
      name: definition.name,
      description: definition.description ?? manifest.description,
      enabled: definition.enabled ?? manifest.enabled,
      priority: definition.priority ?? manifest.priority,
      providers: definition.providers ?? [],
      register: definition.register,
      boot: definition.boot,
    };
  }
}

/**
 * Convenience factory for modular construction.
 */
export function createModular(options: ModularOptions = {}): CarpenterModular {
  return new CarpenterModular(options);
}

async function exists(pathname: string): Promise<boolean> {
  try {
    await access(pathname, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
