/**
 * @module @formwork/core/contracts/container
 * @description IoC Container contracts - ISP-split into Binding, Resolution, and Scoping.
 *
 * Implementations: Container
 *
 * @example
 * ```ts
 * const container = new Container();
 * container.singleton('db', () => new PostgresAdapter(config));
 * const db = container.make<IDatabaseAdapter>('db');
 * ```
 */

import type { Factory, Token } from "../../types/index.js";

/**
 * Responsible for registering bindings in the container.
 * @typedef {Object} IBindingRegistry
 */
export interface IBindingRegistry {
  /**
   * Register a transient binding - new instance per resolution.
   * @param {Token<T>} abstract - Service identifier (string or class)
   * @param {Factory<T>} factory - Factory that creates the instance
   * @returns {void}
   * @example
   * ```ts
   * container.bind('logger', (c) => new Logger(c.make('config')));
   * ```
   */
  bind<T>(abstract: Token<T>, factory: Factory<T>): void;

  /**
   * Register a singleton binding - same instance for all resolutions.
   * @param {Token<T>} abstract - Service identifier
   * @param {Factory<T>} factory - Factory called once, result cached
   * @returns {void}
   * @example
   * ```ts
   * container.singleton('db', () => new PostgresAdapter(config));
   * ```
   */
  singleton<T>(abstract: Token<T>, factory: Factory<T>): void;

  /**
   * Register a pre-built instance.
   * @param {Token<T>} abstract - Service identifier
   * @param {T} value - The instance to register
   * @returns {void}
   */
  instance<T>(abstract: Token<T>, value: T): void;

  /**
   * Create an alias from one token to another.
   * @param {Token} abstract - Original token
   * @param {Token} alias - Alias token that resolves to the same binding
   * @returns {void}
   */
  alias(abstract: Token, alias: Token): void;
}

/**
 * Responsible for resolving instances from the container.
 * @typedef {Object} IResolver
 */
export interface IResolver {
  /**
   * Resolve an instance - auto-wires constructor dependencies.
   * @param {Token<T>} abstract - Service identifier
   * @returns {T} Resolved instance
   * @throws {Error} If binding not found and cannot be auto-wired
   * @example
   * ```ts
   * const db = container.make<IDatabaseAdapter>('db');
   * ```
   */
  make<T>(abstract: Token<T>): T;

  /**
   * Resolve with explicit parameter overrides.
   * @param {Token<T>} abstract - Service identifier
   * @param {Record<string, unknown>} params - Named parameter overrides
   * @returns {T} Resolved instance
   */
  makeWith<T>(abstract: Token<T>, params: Record<string, unknown>): T;

  /**
   * Check if a binding exists.
   * @param {Token} abstract - Service identifier
   * @returns {boolean} True if bound
   */
  bound(abstract: Token): boolean;
}

/**
 * Responsible for creating child scopes (request-scoped containers).
 * @typedef {Object} IScopeFactory
 */
export interface IScopeFactory {
  /**
   * Create a child container that inherits parent bindings.
   * @returns {IContainer} Scoped child container
   */
  scope(): IContainer;
}

/**
 * Full container interface - extends Binding + Resolution + Scoping.
 * @typedef {Object} IContainer
 *
 * @example
 * ```ts
 * const container = new Container();
 * container.singleton('cache', () => new MemoryCacheStore());
 * container.tag('infrastructure', ['db', 'cache', 'queue']);
 * const services = container.tagged<unknown>('infrastructure');
 * ```
 */
export interface IContainer extends IBindingRegistry, IResolver, IScopeFactory {
  /**
   * Tag multiple bindings under a group name.
   * @param {string} tag - Group name
   * @param {Token[]} tokens - Bindings to tag
   * @returns {void}
   */
  tag(tag: string, tokens: Token[]): void;

  /**
   * Resolve all bindings tagged with a given tag.
   * @param {string} tag - Group name
   * @returns {T[]} Array of resolved instances
   */
  tagged<T>(tag: string): T[];

  /**
   * Execute a callback when a binding is resolved for the first time.
   * @param {Token<T>} abstract - Service identifier
   * @param {Function} callback - Called with (instance, container)
   * @returns {void}
   */
  resolving<T>(abstract: Token<T>, callback: (instance: T, container: IContainer) => void): void;

  /**
   * Check if a binding exists (alias for bound()).
   * @param {Token} abstract - Service identifier
   * @returns {boolean}
   */
  has?(abstract: Token): boolean;

  /**
   * Flush all bindings and resolved instances.
   * @returns {void}
   */
  flush(): void;
}

/**
 * Service Provider - organizes bindings into logical groups.
 *
 * Lifecycle:
 *   1. register() - bind services (cannot resolve other services yet)
 *   2. boot() - resolve services, set up routes/middleware
 *
 * @example
 * ```ts
 * class DatabaseProvider extends ServiceProvider {
 *   register() {
 *     this.app.singleton('db', () => new PostgresAdapter(config));
 *   }
 *   boot() {
 *     const db = this.app.make('db');
 *     db.runMigrations();
 *   }
 * }
 * ```
 */
export abstract class ServiceProvider {
  /**
   * @param {IContainer} app - The application container
   */
  constructor(protected readonly app: IContainer) {}

  /**
   * Register bindings - called before boot(). Do NOT resolve services here.
   * @returns {void}
   */
  abstract register(): void;

  /**
   * Boot services - called after ALL providers have registered.
   * @returns {void | Promise<void>}
   */
  boot(): void | Promise<void> {}

  /**
   * For deferred providers: return the tokens this provider registers.
   * @returns {Token[]} Array of tokens this provider can resolve
   */
  provides(): Token[] {
    return [];
  }

  /**
   * Whether this provider should be deferred (lazy-loaded).
   * @returns {boolean}
   */
  isDeferred(): boolean {
    return this.provides().length > 0;
  }
}

export const METADATA_KEYS = {
  INJECTABLE: "carpenter:injectable",
  SINGLETON: "carpenter:scope:singleton",
  INJECT: "carpenter:inject",
  NAMED: "carpenter:named",
  OPTIONAL: "carpenter:optional",
  PARAM_TYPES: "design:paramtypes",
} as const;

/** @typedef {'transient' | 'singleton' | 'scoped'} BindingScope */
export type BindingScope = "transient" | "singleton" | "scoped";

/** @typedef {Object} BindingDescriptor */
export interface BindingDescriptor<T = unknown> {
  /** @property {Token<T>} token - Service identifier */
  token: Token<T>;
  /** @property {Factory<T>} factory - Instance factory */
  factory: Factory<T>;
  /** @property {BindingScope} scope - Lifecycle scope */
  scope: BindingScope;
  /** @property {T} [instance] - Cached singleton instance */
  instance?: T;
}
