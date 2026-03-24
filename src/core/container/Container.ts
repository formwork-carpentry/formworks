/**
 * @module @carpentry/core
 * @description Full IoC/DI Container with auto-wiring, scoping, circular dependency detection
 * @patterns Singleton, Factory Method, Flyweight (scoped reuse)
 * @principles SRP, OCP, LSP, ISP, DIP — see inline comments
 */

import "reflect-metadata";
import type { BindingDescriptor, IContainer } from "../../contracts/container/index.js";
import { METADATA_KEYS } from "../../contracts/container/index.js";
import {
  BindingNotFoundError,
  CircularDependencyError,
  ContainerError,
} from "../exceptions/index.js";
import type { Constructor, Factory, IDisposable, Token } from "../types/index.js";

/** Check if a value is a constructable class */
function isConstructor(value: unknown): boolean {
  return (
    typeof value === "function" &&
    value.prototype !== undefined &&
    value.prototype.constructor === value
  );
}

/** Track IDisposable instances for cleanup */
function findDisposable(value: unknown): IDisposable | null {
  /**
   * @param {unknown} [value !== null && typeof value === 'object' && 'dispose' in value && typeof (value as IDisposable]
   */
  if (
    value !== null &&
    typeof value === "object" &&
    "dispose" in value &&
    typeof (value as IDisposable).dispose === "function"
  ) {
    return value as IDisposable;
  }
  return null;
}

/**
 * IoC/DI container with bindings, singletons, aliases, tags, and child scopes.
 *
 * Key features:
 * - `bind` / `singleton` / `instance` for explicit wiring
 * - `make` / `makeWith` for resolving dependencies
 * - Aliases and tags for flexible lookup
 * - Tracks `dispose()`-capable instances and calls them on `destroy()`
 * - Detects circular dependencies and throws {@link CircularDependencyError}
 *
 * @example
 * ```ts
 * import { Container } from '..';
 *
 * const container = new Container();
 *
 * container.singleton('db', () => ({
 *   query: (sql: string) => `ok: ${sql}`,
 * }));
 *
 * const db = container.make<{ query: (sql: string) => string }>('db');
 * db.query('select 1');
 * ```
 *
 * @remarks
 * Auto-wiring of classes requires the target to be decorated with `@Injectable()`.
 * If you rely on constructor parameters, use `@Inject(token)` to disambiguate.
 */
export class Container implements IContainer {
  private bindingMap = new Map<Token, BindingDescriptor>();
  private instanceMap = new Map<Token, unknown>();
  private aliasMap = new Map<Token, Token>();
  private tagMap = new Map<string, Set<Token>>();
  private resolvingCallbackMap = new Map<
    Token,
    Array<(instance: unknown, container: IContainer) => void>
  >();
  private parent: Container | null = null;
  private disposables: IDisposable[] = [];

  /** Container-level resolution tracking for circular dependency detection across nested make() calls */
  private activeResolutions = new Set<Token>();
  private resolutionDepth = 0;
  /**
   * @param {Token<T>} abstract
   * @param {Factory<T>} factory
   */
  bind<T>(abstract: Token<T>, factory: Factory<T>): void {
    this.bindingMap.set(abstract, {
      token: abstract,
      factory: factory as Factory<unknown>,
      scope: "transient",
    });
  }

  /**
   * @param {Token<T>} abstract
   * @param {Factory<T>} factory
   */
  singleton<T>(abstract: Token<T>, factory: Factory<T>): void {
    this.bindingMap.set(abstract, {
      token: abstract,
      factory: factory as Factory<unknown>,
      scope: "singleton",
    });
  }

  /**
   * @param {Token<T>} abstract
   * @param {T} value
   */
  instance<T>(abstract: Token<T>, value: T): void {
    this.instanceMap.set(abstract, value);
    this.bindingMap.set(abstract, {
      token: abstract,
      factory: () => value,
      scope: "singleton",
      instance: value,
    });
  }

  /**
   * @param {Token} abstract
   * @param {Token} aliasToken
   */
  alias(abstract: Token, aliasToken: Token): void {
    this.aliasMap.set(aliasToken, abstract);
  }
  /**
   * @param {Token<T>} abstract
   * @returns {T} Resolved instance
   *
   * @throws {BindingNotFoundError} When the binding (or auto-wire target) is not registered.
   * @throws {CircularDependencyError} When circular resolution is detected.
   *
   * @example
   * ```ts
   * container.bind('answer', () => 42);
   * const answer = container.make<number>('answer');
   * ```
   */
  make<T>(abstract: Token<T>): T {
    const isTopLevel = this.resolutionDepth === 0;
    this.resolutionDepth++;
    try {
      return this.resolveToken<T>(abstract);
    } finally {
      this.resolutionDepth--;
      if (isTopLevel) {
        this.activeResolutions.clear();
      }
    }
  }

  /**
   * @param {Token<T>} abstract
   * @param params - Temporary parameter bindings for resolution.
   * @returns {T} Resolved instance.
   *
   * @throws {BindingNotFoundError} When the binding (or auto-wire target) is not registered.
   *
   * @example
   * ```ts
   * // Provide constructor parameter values just for this resolution
   * const service = container.makeWith('mailer', { smtpHost: 'localhost' });
   * ```
   */
  makeWith<T>(abstract: Token<T>, params: Record<string, unknown>): T {
    // Bind params into THIS container temporarily, resolve, then remove
    const tempKeys: Token[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (!this.bindingMap.has(key) && !this.instanceMap.has(key)) {
        tempKeys.push(key);
      }
      this.instanceMap.set(key, value);
    }

    try {
      return this.make<T>(abstract);
    } finally {
      // Clean up temporary bindings
      for (const key of tempKeys) {
        this.instanceMap.delete(key);
      }
    }
  }

  /**
   * @param {Token} abstract
   * @returns {boolean}
   */
  bound(abstract: Token): boolean {
    const resolved = this.resolveAlias(abstract);
    if (this.bindingMap.has(resolved) || this.instanceMap.has(resolved)) {
      return true;
    }
    return this.parent?.bound(resolved) ?? false;
  }
  scope(): IContainer {
    const child = new Container();
    child.parent = this;
    return child;
  }
  /**
   * @param {string} tagName
   * @param {Token[]} tokens
   */
  tag(tagName: string, tokens: Token[]): void {
    if (!this.tagMap.has(tagName)) {
      this.tagMap.set(tagName, new Set());
    }
    const set = this.tagMap.get(tagName);
    if (set) {
      for (const token of tokens) {
        set.add(token);
      }
    }
  }

  /**
   * @param {string} tagName
   * @returns {T[]}
   */
  tagged<T>(tagName: string): T[] {
    const tokens = this.tagMap.get(tagName);
    if (!tokens) return [];
    return Array.from(tokens).map((token) => this.make<T>(token as Token<T>));
  }

  /**
   * @param {Token<T>} abstract
   * @param {(instance: T, container: IContainer} callback
   */
  resolving<T>(abstract: Token<T>, callback: (instance: T, container: IContainer) => void): void {
    if (!this.resolvingCallbackMap.has(abstract)) {
      this.resolvingCallbackMap.set(abstract, []);
    }
    this.resolvingCallbackMap.get(abstract)?.push(callback as (i: unknown, c: IContainer) => void);
  }

  flush(): void {
    this.bindingMap.clear();
    this.instanceMap.clear();
    this.aliasMap.clear();
    this.tagMap.clear();
    this.resolvingCallbackMap.clear();
  }

  async destroy(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables = [];
    this.instanceMap.clear();
  }
  private resolveToken<T>(abstract: Token<T>): T {
    const resolved = this.resolveAlias(abstract);

    // 1. Pre-built instance (not subject to circular check — already exists)
    if (this.instanceMap.has(resolved)) {
      return this.instanceMap.get(resolved) as T;
    }

    // 2. Binding in this container
    const descriptor = this.bindingMap.get(resolved);
    if (descriptor) {
      return this.buildFromDescriptor<T>(resolved, descriptor);
    }

    // 3. Parent fallback
    if (this.parent) {
      const parentDescriptor = this.findInParent(resolved);
      if (parentDescriptor) {
        if (parentDescriptor.scope === "scoped") {
          return this.buildFromDescriptor<T>(resolved, parentDescriptor);
        }
        // Delegate to parent but share our activeResolutions
        const prevActive = this.parent.activeResolutions;
        this.parent.activeResolutions = this.activeResolutions;
        this.parent.resolutionDepth++;
        try {
          return this.parent.resolveToken<T>(abstract);
        } finally {
          this.parent.resolutionDepth--;
          this.parent.activeResolutions = prevActive;
        }
      }
    }

    // 4. Auto-wire class constructors
    if (typeof resolved === "function" && isConstructor(resolved)) {
      return this.autoWire<T>(resolved as Constructor<T>);
    }

    // biome-ignore lint/complexity/noBannedTypes: Function type used for token representation in error
    throw new BindingNotFoundError(resolved as string | symbol | Function);
  }

  private buildFromDescriptor<T>(token: Token, descriptor: BindingDescriptor): T {
    this.checkCircular(token);
    this.activeResolutions.add(token);
    try {
      if (descriptor.scope === "singleton" && this.instanceMap.has(token)) {
        return this.instanceMap.get(token) as T;
      }
      const instance = descriptor.factory(this) as T;
      if (descriptor.scope === "singleton" || descriptor.scope === "scoped") {
        this.instanceMap.set(token, instance);
      }
      this.trackDisposable(instance);
      this.fireCallbacks(token, instance);
      return instance;
    } finally {
      this.activeResolutions.delete(token);
    }
  }

  private autoWire<T>(target: Constructor<T>): T {
    this.validateInjectable(target);
    this.checkCircular(target);

    this.activeResolutions.add(target);
    try {
      const resolved = this.resolveConstructorParams(target);
      const instance = new target(...resolved);

      if (Reflect.getMetadata(METADATA_KEYS.SINGLETON, target)) {
        this.instanceMap.set(target, instance);
        this.bindingMap.set(target, {
          token: target,
          factory: () => instance,
          scope: "singleton",
          instance,
        });
      }

      this.trackDisposable(instance);
      this.fireCallbacks(target, instance);
      return instance;
    } finally {
      this.activeResolutions.delete(target);
    }
  }

  private validateInjectable(target: Constructor): void {
    if (!Reflect.getMetadata(METADATA_KEYS.INJECTABLE, target)) {
      throw new ContainerError(
        `Class "${target.name}" is not marked as @Injectable(). Add @Injectable() or register explicitly via container.bind().`,
        { className: target.name },
      );
    }
  }

  private checkCircular(target: Token): void {
    if (this.activeResolutions.has(target)) {
      const arr = [...this.activeResolutions, target].map((t) =>
        typeof t === "function" ? t.name : String(t),
      );
      throw new CircularDependencyError(arr);
    }
  }

  private resolveConstructorParams(target: Constructor): unknown[] {
    const paramTypes: (Constructor | undefined)[] =
      Reflect.getMetadata(METADATA_KEYS.PARAM_TYPES, target) ?? [];

    return paramTypes.map((paramType, idx) => {
      const override: Token | undefined = Reflect.getMetadata(
        `${METADATA_KEYS.INJECT}:${idx}`,
        target,
      );
      const token = override ?? paramType;
      if (!token) {
        throw new ContainerError(
          `Cannot resolve parameter ${idx} of "${target.name}". Use @Inject(token).`,
          { className: target.name, paramIndex: idx },
        );
      }
      return this.resolveToken(token);
    });
  }
  private resolveAlias(token: Token): Token {
    let current = token;
    const seen = new Set<Token>();
    while (this.aliasMap.has(current)) {
      if (seen.has(current)) {
        throw new ContainerError(`Circular alias detected for: ${String(current)}`);
      }
      seen.add(current);
      const next = this.aliasMap.get(current);
      if (!next) break;
      current = next;
    }
    return current;
  }

  private findInParent(token: Token): BindingDescriptor | undefined {
    let current: Container | null = this.parent;
    while (current) {
      const desc = current.bindingMap.get(token);
      if (desc) return desc;
      current = current.parent;
    }
    return undefined;
  }

  private trackDisposable(value: unknown): void {
    const d = findDisposable(value);
    if (d) this.disposables.push(d);
  }

  private fireCallbacks(token: Token, instance: unknown): void {
    const cbs = this.resolvingCallbackMap.get(token);
    if (cbs) for (const cb of cbs) cb(instance, this);
  }
}
