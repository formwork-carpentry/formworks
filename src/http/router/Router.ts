/**
 * @module @carpentry/http
 * @description Router — fluent route registration, matching, named routes, resource/API resources
 * @patterns Builder (fluent registration), Composite (route groups), Strategy (matching)
 * @principles OCP — new routes without modifying router; SRP — routing logic only
 */

import type {
  HttpMethod,
  IRoute,
  IRouteRegistrar,
  IRouter,
  ResolvedRoute,
  RouteGroupOptions,
  RouteHandler,
} from "@carpentry/formworks/contracts";
import type { Constructor, Dictionary, Token } from "@carpentry/formworks/core/types";

// ── Route Data ────────────────────────────────────────────

interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  name?: string;
  middleware: (Token | string)[];
  constraints: Map<string, RegExp>;
  /** Compiled regex + param names for matching */
  regex?: RegExp;
  paramNames?: string[];
}

// ── Route Registrar (fluent builder returned from route methods) ──

class RouteRegistrar implements IRouteRegistrar {
  constructor(private route: RouteDefinition) {}

  /**
   * @param {string} routeName
   * @returns {this}
   */
  name(routeName: string): this {
    this.route.name = routeName;
    return this;
  }

  /**
   * @param {(Token | string} ...middleware
   * @returns {this}
   */
  middleware(...middleware: (Token | string)[]): this {
    this.route.middleware.push(...middleware);
    return this;
  }

  /**
   * @param {string} param
   * @param {RegExp} pattern
   * @returns {this}
   */
  where(param: string, pattern: RegExp): this {
    this.route.constraints.set(param, pattern);
    return this;
  }
}

// ── Router Implementation ─────────────────────────────────

/**
 * Router — register and resolve routes with parameter extraction and route naming.
 *
 * Routes are matched in registration order. Use `resource()` to create a standard
 * RESTful CRUD set of routes, and `group()` to apply shared middleware/prefixes.
 *
 * @example
 * ```ts
 * const router = new Router();
 * router.get('/health', async () => CarpenterResponse.json({ ok: true }));
 * const resolved = router.resolve('GET', '/health');
 * // resolved.route.handler can be invoked by HttpKernel
 * ```
 */
export class Router implements IRouter {
  private routes: RouteDefinition[] = [];
  private nameIndex = new Map<string, RouteDefinition>();

  /** Current group stack — nested groups push/pop from here */
  private groupStack: RouteGroupOptions[] = [];

  // ── Route Registration ──────────────────────────────────

  /**
   * @param {string} path
   * @param {RouteHandler} handler
   * @returns {IRouteRegistrar}
   */
  get(path: string, handler: RouteHandler): IRouteRegistrar {
    return this.addRoute("GET", path, handler);
  }

  /**
   * @param {string} path
   * @param {RouteHandler} handler
   * @returns {IRouteRegistrar}
   */
  post(path: string, handler: RouteHandler): IRouteRegistrar {
    return this.addRoute("POST", path, handler);
  }

  /**
   * @param {string} path
   * @param {RouteHandler} handler
   * @returns {IRouteRegistrar}
   */
  put(path: string, handler: RouteHandler): IRouteRegistrar {
    return this.addRoute("PUT", path, handler);
  }

  /**
   * @param {string} path
   * @param {RouteHandler} handler
   * @returns {IRouteRegistrar}
   */
  patch(path: string, handler: RouteHandler): IRouteRegistrar {
    return this.addRoute("PATCH", path, handler);
  }

  /**
   * @param {string} path
   * @param {RouteHandler} handler
   * @returns {IRouteRegistrar}
   */
  delete(path: string, handler: RouteHandler): IRouteRegistrar {
    return this.addRoute("DELETE", path, handler);
  }

  // ── Resource Routes ─────────────────────────────────────

  /**
   * @param {string} name
   * @param {Constructor} controller
   */
  resource(name: string, controller: Constructor): void {
    const prefix = `/${name}`;
    this.get(prefix, [controller, "index"]).name(`${name}.index`);
    this.get(`${prefix}/create`, [controller, "create"]).name(`${name}.create`);
    this.post(prefix, [controller, "store"]).name(`${name}.store`);
    this.get(`${prefix}/:id`, [controller, "show"]).name(`${name}.show`);
    this.get(`${prefix}/:id/edit`, [controller, "edit"]).name(`${name}.edit`);
    this.put(`${prefix}/:id`, [controller, "update"]).name(`${name}.update`);
    this.delete(`${prefix}/:id`, [controller, "destroy"]).name(`${name}.destroy`);
  }

  /**
   * @param {string} name
   * @param {Constructor} controller
   */
  apiResource(name: string, controller: Constructor): void {
    const prefix = `/${name}`;
    this.get(prefix, [controller, "index"]).name(`${name}.index`);
    this.post(prefix, [controller, "store"]).name(`${name}.store`);
    this.get(`${prefix}/:id`, [controller, "show"]).name(`${name}.show`);
    this.put(`${prefix}/:id`, [controller, "update"]).name(`${name}.update`);
    this.delete(`${prefix}/:id`, [controller, "destroy"]).name(`${name}.destroy`);
  }

  // ── Route Groups (Composite pattern) ────────────────────

  /**
   * @param {RouteGroupOptions} options
   * @param {(} callback
   */
  group(options: RouteGroupOptions, callback: () => void): void {
    this.groupStack.push(options);
    callback();
    this.groupStack.pop();
  }

  // ── Route Matching ──────────────────────────────────────

  /**
   * @param {HttpMethod} method
   * @param {string} path
   * @returns {ResolvedRoute | null}
   */
  resolve(method: HttpMethod, path: string): ResolvedRoute | null {
    const normalizedPath = this.normalizePath(path);

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const compiled = this.compile(route);
      const match = compiled.regex?.exec(normalizedPath);

      if (match) {
        const params: Dictionary<string> = {};
        compiled.paramNames?.forEach((name, i) => {
          const value = match[i + 1];
          if (value !== undefined) {
            params[name] = value;
          }
        });

        const resolvedRoute: IRoute = {
          method: route.method,
          path: route.path,
          handler: route.handler,
          middleware: route.middleware,
        };
        if (route.name !== undefined) {
          resolvedRoute.name = route.name;
        }

        return {
          route: resolvedRoute,
          params,
        };
      }
    }

    return null;
  }

  // ── Named Route URL Generation ──────────────────────────

  /**
   * @param {string} name
   * @param {Dictionary<string | number>} [params]
   * @returns {string}
   */
  route(name: string, params: Dictionary<string | number> = {}): string {
    const route = this.nameIndex.get(name);
    if (!route) {
      throw new Error(`Route "${name}" not found.`);
    }

    let url = route.path;
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, String(value));
    }

    // Remove any remaining optional params
    url = url.replace(/\/:[^/]+\?/g, "");

    return url;
  }

  /** Get all registered routes (for debugging / inspect) */
  getRoutes(): IRoute[] {
    return this.routes.map((r) => {
      const route: IRoute = {
        method: r.method,
        path: r.path,
        handler: r.handler,
        middleware: r.middleware,
      };
      if (r.name !== undefined) {
        route.name = r.name;
      }
      return route;
    });
  }

  // ── Route Model Binding ────────────────────────────────

  /** Model binding resolvers: param name → resolver function */
  private bindings = new Map<string, (value: string) => unknown | Promise<unknown>>();

  /**
   * Register a route model binding.
   * When a route parameter matches the given name, the resolver
   * is called to convert the raw string value (e.g., "42") into
   * a model instance.
   *
   * @example
   * ```ts
   * router.bind('post', (value) => Post.findOrFail(value));
   * router.bind('user', (value) => User.where('slug', value).firstOrFail());
   * ```
   */
  bind(param: string, resolver: (value: string) => unknown | Promise<unknown>): void {
    this.bindings.set(param, resolver);
  }

  /**
   * Resolve model bindings for a set of route parameters.
   * Returns a new params object with resolved values.
   */
  async resolveBindings(params: Dictionary<string>): Promise<Dictionary<unknown>> {
    const resolved: Dictionary<unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      const resolver = this.bindings.get(key);
      if (resolver) {
        resolved[key] = await resolver(value);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  /**
   * Check if a binding exists for the given parameter.
   */
  hasBinding(param: string): boolean {
    return this.bindings.has(param);
  }

  // ── Internal ────────────────────────────────────────────

  private addRoute(method: HttpMethod, path: string, handler: RouteHandler): RouteRegistrar {
    const fullPath = this.computeGroupPrefix() + this.normalizePath(path);
    const groupMiddleware = this.computeGroupMiddleware();

    const route: RouteDefinition = {
      method,
      path: fullPath,
      handler,
      middleware: [...groupMiddleware],
      constraints: new Map(),
    };

    this.routes.push(route);

    const registrar = new RouteRegistrar(route);

    // Override name() to index named routes with duplicate detection
    registrar.name = (routeName: string) => {
      const prefixedName = this.computeGroupNamePrefix() + routeName;
      if (this.nameIndex.has(prefixedName)) {
        throw new Error(`Duplicate route name: "${prefixedName}"`);
      }
      route.name = prefixedName;
      this.nameIndex.set(prefixedName, route);
      return registrar;
    };

    return registrar;
  }

  private compile(route: RouteDefinition): RouteDefinition {
    if (route.regex) return route;

    const paramNames: string[] = [];
    const regexStr = route.path
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        // Optional parameter: :id?
        if (segment.startsWith(":") && segment.endsWith("?")) {
          const paramName = segment.slice(1, -1);
          paramNames.push(paramName);
          const constraint = route.constraints.get(paramName);
          const pattern = constraint ? constraint.source : "[^/]+";
          return `(?:/(${pattern}))?`;
        }
        // Required parameter: :id
        if (segment.startsWith(":")) {
          const paramName = segment.slice(1);
          paramNames.push(paramName);
          const constraint = route.constraints.get(paramName);
          const pattern = constraint ? constraint.source : "[^/]+";
          return `/(${pattern})`;
        }
        // Literal segment
        return `/${this.escapeRegex(segment)}`;
      })
      .join("");

    route.regex = new RegExp(`^${regexStr || "/"}$`);
    route.paramNames = paramNames;

    return route;
  }

  private computeGroupPrefix(): string {
    return this.groupStack
      .map((g) => g.prefix ?? "")
      .filter(Boolean)
      .map((p) => this.normalizePath(p))
      .join("");
  }

  private computeGroupMiddleware(): (Token | string)[] {
    return this.groupStack.flatMap((g) => g.middleware ?? []);
  }

  private computeGroupNamePrefix(): string {
    return ""; // Can be extended for group name prefixing
  }

  private normalizePath(rawPath: string): string {
    let path = rawPath;
    if (!path.startsWith("/")) path = `/${path}`;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return path;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
