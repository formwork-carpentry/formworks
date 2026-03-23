/**
 * @module @carpentry/core
 * @description TypeScript Language Service Plugin — provides IDE autocomplete,
 * hover info, and diagnostics for Carpenter-specific APIs.
 *
 * WHY: Carpenter uses string-based container bindings ('db', 'cache', 'queue') and
 * config paths ('database.default'). Without a TS plugin, these are untyped strings
 * that can't be autocompleted or validated. The plugin provides:
 * - Autocomplete for container.make('...') binding names
 * - Autocomplete for config.get('...') dot-notation paths
 * - Diagnostics for unknown bindings or config paths
 * - Hover info showing the resolved type of bindings
 *
 * HOW: This is a TypeScript Language Service plugin. Install it in tsconfig.json:
 * ```json
 * { "compilerOptions": { "plugins": [{ "name": "@carpentry/ts-plugin" }] } }
 * ```
 *
 * NOTE: This module defines the plugin API and completion data. The actual TS
 * Language Service integration requires running inside the TypeScript server
 * process, which is editor-specific. This module can be consumed by:
 * - VS Code extension (via tsserver plugin)
 * - JetBrains IDE plugin
 * - vim/neovim LSP client
 *
 * @patterns Strategy (completion providers), Registry (known bindings)
 * @principles OCP (add completion sources without modifying core)
 */

// ── Completion Item ───────────────────────────────────────

export interface CompletionItem {
  /** Display label (e.g., 'db', 'cache.manager') */
  label: string;
  /** Resolved type string (e.g., 'IDatabaseAdapter', 'CacheManager') */
  type: string;
  /** Description shown in hover/detail panel */
  description: string;
  /** Category for grouping in autocomplete list */
  category: "binding" | "config" | "env" | "route";
}

// ── Known Container Bindings ──────────────────────────────
// These are the standard bindings registered by InfrastructureServiceProvider.
// The TS plugin uses this list for container.make() autocomplete.

export const KNOWN_BINDINGS: CompletionItem[] = [
  {
    label: "config",
    type: "Config",
    description: "Application configuration repository",
    category: "binding",
  },
  {
    label: "config.resolver",
    type: "ConfigResolver",
    description: "Typed config accessor with env-awareness",
    category: "binding",
  },
  {
    label: "db",
    type: "IDatabaseAdapter",
    description: "Default database connection",
    category: "binding",
  },
  {
    label: "db.manager",
    type: "DatabaseManager",
    description: "Database connection manager (multi-connection)",
    category: "binding",
  },
  { label: "cache", type: "ICacheStore", description: "Default cache store", category: "binding" },
  {
    label: "cache.manager",
    type: "CacheManager",
    description: "Cache store manager (multi-driver)",
    category: "binding",
  },
  {
    label: "queue",
    type: "IQueueAdapter",
    description: "Default queue connection",
    category: "binding",
  },
  {
    label: "queue.manager",
    type: "QueueManager",
    description: "Queue connection manager",
    category: "binding",
  },
  { label: "mail", type: "IMailAdapter", description: "Default mail adapter", category: "binding" },
  {
    label: "mail.manager",
    type: "MailManager",
    description: "Mail adapter manager (multi-driver)",
    category: "binding",
  },
  {
    label: "storage",
    type: "IStorageAdapter",
    description: "Default storage disk",
    category: "binding",
  },
  {
    label: "storage.manager",
    type: "StorageManager",
    description: "Storage disk manager",
    category: "binding",
  },
  {
    label: "events",
    type: "EventDispatcher",
    description: "Application event dispatcher",
    category: "binding",
  },
  {
    label: "validator",
    type: "Validator",
    description: "Input validation engine",
    category: "binding",
  },
  { label: "logger", type: "LogManager", description: "Logging manager", category: "binding" },
];

// ── Known Config Paths ────────────────────────────────────
// Standard config paths from buildDefaultConfig() for config.get() autocomplete.

export const KNOWN_CONFIG_PATHS: CompletionItem[] = [
  {
    label: "app.name",
    type: "string",
    description: "Application name (APP_NAME)",
    category: "config",
  },
  {
    label: "app.env",
    type: "string",
    description: "Environment: development | production | testing",
    category: "config",
  },
  {
    label: "app.debug",
    type: "boolean",
    description: "Debug mode (APP_DEBUG)",
    category: "config",
  },
  {
    label: "app.key",
    type: "string",
    description: "Application encryption key (APP_KEY)",
    category: "config",
  },
  {
    label: "app.url",
    type: "string",
    description: "Application URL (APP_URL)",
    category: "config",
  },
  { label: "app.port", type: "number", description: "HTTP port (PORT)", category: "config" },
  {
    label: "database.default",
    type: "string",
    description: "Default database connection name",
    category: "config",
  },
  {
    label: "cache.default",
    type: "string",
    description: "Default cache driver name",
    category: "config",
  },
  {
    label: "queue.default",
    type: "string",
    description: "Default queue connection name",
    category: "config",
  },
  { label: "mail.default", type: "string", description: "Default mailer name", category: "config" },
  {
    label: "storage.default",
    type: "string",
    description: "Default filesystem disk name",
    category: "config",
  },
  {
    label: "session.driver",
    type: "string",
    description: "Session driver name",
    category: "config",
  },
  {
    label: "session.lifetime",
    type: "number",
    description: "Session lifetime in minutes",
    category: "config",
  },
  {
    label: "logging.default",
    type: "string",
    description: "Default log channel",
    category: "config",
  },
  {
    label: "auth.defaults.guard",
    type: "string",
    description: "Default auth guard",
    category: "config",
  },
];

// ── Completion Provider ───────────────────────────────────

/**
 * CompletionProvider — provides autocomplete items for a given context.
 *
 * @example
 * ```ts
 * const provider = new CompletionProvider();
 *
 * // When user types: container.make('|')
 * const items = provider.getBindingCompletions('');
 * // → [{ label: 'db', type: 'IDatabaseAdapter', ... }, ...]
 *
 * // When user types: config.get('app.|')
 * const configItems = provider.getConfigCompletions('app.');
 * // → [{ label: 'app.name', ... }, { label: 'app.env', ... }, ...]
 * ```
 */
export class CompletionProvider {
  private bindings: CompletionItem[] = [...KNOWN_BINDINGS];
  private configPaths: CompletionItem[] = [...KNOWN_CONFIG_PATHS];

  /** Add a custom binding to the autocomplete list (for plugins) */
  /**
   * @param {CompletionItem} item
   * @returns {this}
   */
  addBinding(item: CompletionItem): this {
    this.bindings.push(item);
    return this;
  }

  /** Add a custom config path */
  /**
   * @param {CompletionItem} item
   * @returns {this}
   */
  addConfigPath(item: CompletionItem): this {
    this.configPaths.push(item);
    return this;
  }

  /**
   * Get autocomplete items for container.make() calls.
   * @param prefix - What the user has typed so far (e.g., 'db', 'cache.')
   */
  getBindingCompletions(prefix: string): CompletionItem[] {
    if (!prefix) return this.bindings;
    return this.bindings.filter((b) => b.label.startsWith(prefix));
  }

  /**
   * Get autocomplete items for config.get() calls.
   * @param prefix - The config path typed so far (e.g., 'app.', 'database.')
   */
  getConfigCompletions(prefix: string): CompletionItem[] {
    if (!prefix) return this.configPaths;
    return this.configPaths.filter((p) => p.label.startsWith(prefix));
  }

  /**
   * Validate a binding name — returns an error message if unknown.
   * Used for TS diagnostics (red underlines in the editor).
   */
  validateBinding(name: string): string | null {
    const found = this.bindings.find((b) => b.label === name);
    if (!found)
      return `Unknown container binding: "${name}". Available: ${this.bindings.map((b) => b.label).join(", ")}`;
    return null;
  }

  /**
   * Validate a config path — returns an error message if unknown.
   */
  validateConfigPath(path: string): string | null {
    const found = this.configPaths.find((p) => p.label === path);
    if (!found)
      return `Unknown config path: "${path}". Did you mean: ${this.getSuggestions(path, this.configPaths)}?`;
    return null;
  }

  /** Get type info for a binding (shown on hover in the editor) */
  /**
   * @param {string} name
   */
  getBindingType(name: string): { type: string; description: string } | null {
    const found = this.bindings.find((b) => b.label === name);
    return found ? { type: found.type, description: found.description } : null;
  }

  /** Suggest similar items when the user makes a typo */
  private getSuggestions(input: string, items: CompletionItem[]): string {
    const prefix = input.split(".")[0];
    return (
      items
        .filter((i) => i.label.startsWith(prefix))
        .slice(0, 3)
        .map((i) => i.label)
        .join(", ") || "(none)"
    );
  }
}
