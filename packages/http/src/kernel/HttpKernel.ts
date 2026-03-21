/**
 * @module @formwork/http
 * @description HTTP Kernel — full request lifecycle: parse → scope → route → middleware → dispatch → respond
 * @patterns Template Method (handle lifecycle), Chain of Responsibility (middleware + exception)
 * @principles SRP — orchestrates lifecycle only; DIP — depends on IContainer, IRouter interfaces
 */

import type { IContainer } from "@formwork/core/container";
import type {
  HttpMethod,
  IHttpKernel,
  IMiddleware,
  IRequest,
  IResponse,
  ResolvedRoute,
  RouteHandler,
} from "@formwork/core/contracts";
import { MethodNotAllowedError, NotFoundError } from "@formwork/core/exceptions";
import type { Token } from "@formwork/core/types";
import { Pipeline } from "../middleware/Pipeline.js";
import { Request } from "../request/Request.js";
import { CarpenterResponse } from "../response/Response.js";
import type { Router } from "../router/Router.js";
import { ExceptionHandler } from "./ExceptionHandler.js";

export interface HttpKernelOptions {
  /** Global middleware applied to every request */
  middleware?: (Token | string | IMiddleware)[];
  /** Whether to show debug info in error responses */
  debug?: boolean;
}

/**
 * HttpKernel — full request lifecycle.
 *
 * It orchestrates:
 * - request-scoped container + body parsing
 * - route resolution via {@link Router}
 * - middleware pipeline execution (global + route middleware)
 * - controller/handler dispatch
 * - error handling via {@link ExceptionHandler}
 *
 * @example
 * ```ts
 * const kernel = new HttpKernel(container, router, { debug: true });
 * const res = await kernel.handle(request);
 * // res is a Carpenter IResponse (convert with toNative() if desired)
 * ```
 */
export class HttpKernel implements IHttpKernel {
  private globalMiddleware: (Token | string | IMiddleware)[] = [];
  private exceptionHandler: ExceptionHandler;

  constructor(
    private readonly container: IContainer,
    private readonly router: Router,
    options: HttpKernelOptions = {},
  ) {
    this.globalMiddleware = options.middleware ?? [];
    this.exceptionHandler = new ExceptionHandler(options.debug ?? false);
  }

  /**
   * Handle an incoming request through the full pipeline.
   *
   * Lifecycle:
   * 1. Create request-scoped child container
   * 2. Parse request body
   * 3. Match route
   * 4. Build middleware pipeline (global + route middleware)
   * 5. Dispatch to controller/handler
   * 6. Return response
   * 7. Destroy scope
   */
  async handle(request: IRequest): Promise<IResponse> {
    const scope = this.container.scope();
    scope.instance("request", request);
    try {
      if (request instanceof Request) await request.parseBody();
      const matched = this.resolveRoute(request);
      if (request instanceof Request) request.setRouteParams(matched.params);

      const allMiddleware = [...this.globalMiddleware, ...matched.route.middleware];
      const resolvedMiddleware = this.resolveMiddleware(allMiddleware, scope);
      const handler = this.buildHandler(matched.route.handler, scope);

      return await Pipeline.create().send(request).through(resolvedMiddleware).then(handler);
    } catch (error) {
      return this.exceptionHandler.render(
        error instanceof Error ? error : new Error(String(error)),
        request,
      );
    }
  }

  /** Match request to a route, or throw 404/405 */
  private resolveRoute(request: IRequest): ResolvedRoute {
    const method = request.method() as HttpMethod;
    const matched = this.router.resolve(method, request.path());
    if (matched) return matched;

    const anyMethodMatch = this.checkAnyMethod(request.path());
    if (anyMethodMatch) throw new MethodNotAllowedError(method, anyMethodMatch);
    throw new NotFoundError(`Route not found: ${method} ${request.path()}`);
  }

  /**
   * @returns {Promise<void>}
   */
  async terminate(_request: IRequest, _response: IResponse): Promise<void> {
    // Post-response processing (logging, terminable middleware, etc.)
    // Will be extended in Sprint 3 with TerminableMiddleware support
  }

  /** Register a custom exception renderer */
  /**
   * @param {(error: Error, request: IRequest} renderer
   */
  onError(renderer: (error: Error, request: IRequest) => IResponse | null): void {
    this.exceptionHandler.register(renderer);
  }

  /** Get the exception handler for testing */
  getExceptionHandler(): ExceptionHandler {
    return this.exceptionHandler;
  }

  // ── Internal ────────────────────────────────────────────

  private resolveMiddleware(
    middleware: (Token | string | IMiddleware)[],
    scope: IContainer,
  ): IMiddleware[] {
    return middleware.map((mw) => {
      // Already an instance
      if (typeof mw === "object" && "handle" in mw) {
        return mw as IMiddleware;
      }

      // Resolve from container by token
      if (scope.bound(mw)) {
        return scope.make<IMiddleware>(mw);
      }

      // If it's a string/symbol that's not bound, skip it
      // (will be caught by the container when it's properly registered)
      throw new Error(`Middleware "${String(mw)}" is not registered in the container.`);
    });
  }

  private buildHandler(
    routeHandler: RouteHandler,
    scope: IContainer,
  ): (request: IRequest) => Promise<IResponse> {
    if (typeof routeHandler === "function") {
      // Plain function handler
      return async (request: IRequest) => {
        const result = await routeHandler(request);
        if (result && typeof result === "object" && "toNative" in result) {
          return result as unknown as IResponse;
        }
        if (result !== undefined) {
          return CarpenterResponse.json(result);
        }
        return CarpenterResponse.noContent();
      };
    }

    // [ControllerClass, 'methodName'] tuple
    const [ControllerClass, methodName] = routeHandler;

    return async (request: IRequest) => {
      // Resolve controller from IoC (supports constructor injection)
      // biome-ignore lint/complexity/noBannedTypes: controller instance requires Function for generic method dispatch
      let controller: Record<string, Function>;

      if (scope.bound(ControllerClass)) {
        // biome-ignore lint/complexity/noBannedTypes: controller instance requires Function for generic method dispatch
        controller = scope.make(ControllerClass) as Record<string, Function>;
      } else {
        // Direct instantiation for simple controllers
        // biome-ignore lint/complexity/noBannedTypes: controller instance requires Function for generic method dispatch
        controller = new (ControllerClass as new () => Record<string, Function>)();
      }

      const result = await controller[methodName](request);

      // If result is already a response, return it
      if (result && typeof result === "object" && "toNative" in result) {
        return result as unknown as IResponse;
      }

      // Auto-wrap plain objects as JSON
      if (result !== undefined) {
        return CarpenterResponse.json(result);
      }

      return CarpenterResponse.noContent();
    };
  }

  private checkAnyMethod(path: string): string[] | null {
    const methods: Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD"> = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ];
    const allowed = methods.filter((m) => this.router.resolve(m, path) !== null);
    return allowed.length > 0 ? allowed : null;
  }
}
