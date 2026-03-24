/**
 * @module @carpentry/http
 * @description Exception handler — converts CarpenterError subtypes to HTTP responses
 * @patterns Chain of Responsibility (handler chain), Strategy (renderers per error type)
 * @principles OCP — custom handlers registered without modifying ExceptionHandler
 *             SRP — only maps exceptions to responses
 */

import type { IRequest } from "@carpentry/formworks/contracts";
import type { IResponse } from "@carpentry/formworks/contracts";
import {
  AuthenticationError,
  AuthorizationError,
  CarpenterError,
  HttpException,
  MethodNotAllowedError,
  ModelNotFoundError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@carpentry/formworks/core/exceptions";
import { CarpenterResponse } from "../response/Response.js";

export const HTTP_EXCEPTION_HANDLER_TOKEN = "http.exceptionHandler";

export type ExceptionRenderer = (error: Error, request: IRequest) => IResponse | null;

/**
 * ExceptionHandler — maps Carpenter exceptions to HTTP responses.
 *
 * Register custom renderers with `register()`; built-in handlers cover common
 * CarpenterError subclasses like validation/not-found/auth errors.
 *
 * @example
 * ```ts
 * const handler = new ExceptionHandler(true);
 * handler.register((err, _req) => {
 *   // render custom error types here
 *   return null;
 * });
 * const res = handler.render(new Error('boom'), request);
 * ```
 */
export class ExceptionHandler {
  private customRenderers: ExceptionRenderer[] = [];
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  /** Register a custom exception renderer (checked before built-in handlers) */
  /**
   * @param {ExceptionRenderer} renderer
   */
  register(renderer: ExceptionRenderer): void {
    this.customRenderers.push(renderer);
  }

  /** Render any error into an HTTP response */
  /**
   * @param {Error} error
   * @param {IRequest} request
   * @returns {IResponse}
   */
  render(error: Error, request: IRequest): IResponse {
    for (const renderer of this.customRenderers) {
      const result = renderer(error, request);
      if (result) return result;
    }
    return this.renderBuiltIn(error);
  }

  /** Map known error types to HTTP responses */
  private renderBuiltIn(error: Error): IResponse {
    if (error instanceof ValidationError) {
      return CarpenterResponse.json({ message: error.message, errors: error.errors }, 422);
    }
    if (error instanceof NotFoundError || error instanceof ModelNotFoundError) {
      return CarpenterResponse.json({ message: error.message }, 404);
    }
    if (error instanceof AuthenticationError) {
      return CarpenterResponse.json({ message: error.message }, 401);
    }
    if (error instanceof AuthorizationError) {
      return CarpenterResponse.json({ message: error.message }, 403);
    }
    if (error instanceof MethodNotAllowedError) {
      return CarpenterResponse.json({ message: error.message }, 405);
    }
    if (error instanceof TooManyRequestsError) {
      return CarpenterResponse.json({ message: error.message }, 429).header(
        "retry-after",
        String(error.retryAfter),
      );
    }
    if (error instanceof HttpException) {
      return CarpenterResponse.json({ message: error.message }, error.statusCode);
    }
    return this.renderGeneric(error);
  }

  /** Render unknown/generic errors */
  private renderGeneric(error: Error): IResponse {
    if (error instanceof CarpenterError) {
      return CarpenterResponse.json(
        {
          message: this.debug ? error.message : "Internal Server Error",
          ...(this.debug ? { code: error.code, context: error.context } : {}),
        },
        500,
      );
    }
    return CarpenterResponse.json(
      {
        message: this.debug ? error.message : "Internal Server Error",
        ...(this.debug ? { stack: error.stack } : {}),
      },
      500,
    );
  }
}

export function createExceptionHandler(debug = false): ExceptionHandler {
  return new ExceptionHandler(debug);
}
