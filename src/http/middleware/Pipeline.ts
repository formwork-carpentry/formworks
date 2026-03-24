/**
 * @module @carpentry/http
 * @description Middleware pipeline — processes request through ordered middleware chain
 * @patterns Chain of Responsibility (middleware chain), Composite (pipeline as a unit)
 * @principles OCP — new middleware without modifying pipeline; SRP — pipeline orchestration only
 */

import type { IMiddleware, IRequest, IResponse, NextFunction } from "@carpentry/formworks/contracts";
import { Pipeline as GenericPipeline } from "@carpentry/formworks/pipeline";

export type MiddlewareFunction = (request: IRequest, next: NextFunction) => Promise<IResponse>;
export type MiddlewareEntry = IMiddleware | MiddlewareFunction;

/**
 * Executes middleware in registration order, ending with a terminal handler.
 *
 * @example
 * ```typescript
 * const response = await Pipeline.create()
 *   .send(request)
 *   .through([CorsMiddleware, AuthMiddleware, loggerFn])
 *   .then(routeHandler);
 * ```
 */
export class Pipeline {
  private passable!: IRequest;
  private pipes: MiddlewareEntry[] = [];

  static create(): Pipeline {
    return new Pipeline();
  }

  /** Set the object being passed through the pipeline */
  /**
   * @param {IRequest} passable
   * @returns {this}
   */
  send(passable: IRequest): this {
    this.passable = passable;
    return this;
  }

  /** Set the middleware to pass through */
  /**
   * @param {MiddlewareEntry[]} pipes
   * @returns {this}
   */
  through(pipes: MiddlewareEntry[]): this {
    this.pipes = pipes;
    return this;
  }

  /** Add additional middleware to the end */
  /**
   * @param {MiddlewareEntry[]} ...pipes
   * @returns {this}
   */
  pipe(...pipes: MiddlewareEntry[]): this {
    this.pipes.push(...pipes);
    return this;
  }

  /** Execute the pipeline with a terminal handler at the end */
  /**
   * @param {(request: IRequest} destination
   * @returns {Promise<IResponse>}
   */
  // biome-ignore lint/suspicious/noThenProperty: Pipeline.then() is the intentional fluent API entry point (Laravel-style pipeline pattern)
  async then(destination: (request: IRequest) => Promise<IResponse>): Promise<IResponse> {
    const normalized = this.pipes.map((middleware) => {
      if (typeof middleware === "function") {
        return async (request: IRequest, next: (request: IRequest) => Promise<IResponse>) => {
          const nextFn: NextFunction = async () => next(request);
          return (middleware as MiddlewareFunction)(request, nextFn);
        };
      }

      return async (request: IRequest, next: (request: IRequest) => Promise<IResponse>) => {
        const nextFn: NextFunction = async () => next(request);
        return (middleware as IMiddleware).handle(request, nextFn);
      };
    });

    return GenericPipeline.create<IRequest, IResponse>()
      .send(this.passable)
      .through(normalized)
      .then(destination);
  }
}
