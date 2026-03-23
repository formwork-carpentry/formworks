/**
 * @module @carpentry/http
 * @description Middleware pipeline — processes request through ordered middleware chain
 * @patterns Chain of Responsibility (middleware chain), Composite (pipeline as a unit)
 * @principles OCP — new middleware without modifying pipeline; SRP — pipeline orchestration only
 */

import type { IMiddleware, IRequest, IResponse, NextFunction } from "@carpentry/core/contracts";

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
    const pipeline = this.buildPipeline(destination);
    return pipeline(this.passable);
  }

  /**
   * Build a composed function that chains all middleware.
   * Each middleware calls next() to invoke the next one in the chain.
   * The last "next" is the destination handler.
   */
  private buildPipeline(
    destination: (request: IRequest) => Promise<IResponse>,
  ): (request: IRequest) => Promise<IResponse> {
    // Start from the destination and wrap backward through middleware
    return this.pipes.reduceRight<(request: IRequest) => Promise<IResponse>>((next, middleware) => {
      return async (request: IRequest) => {
        const nextFn: NextFunction = () => next(request);

        if (typeof middleware === "function" && !("handle" in middleware)) {
          // Plain function middleware
          return (middleware as MiddlewareFunction)(request, nextFn);
        }

        // Class-based middleware (IMiddleware)
        return (middleware as IMiddleware).handle(request, nextFn);
      };
    }, destination);
  }
}
