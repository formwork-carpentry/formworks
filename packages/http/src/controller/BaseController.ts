/**
 * @module @formwork/http
 * @description BaseController — provides common helpers via Template Method pattern
 * @patterns Template Method (controller lifecycle)
 * @principles SRP — helpers delegate to services; DIP — no direct infrastructure access
 */

import type { Dictionary } from "@formwork/core/types";
import { CarpenterResponse, type ViewResponse } from "../response/Response.js";

/**
 * HTTP controller base with `json`, `view`, `redirect`, and status helpers.
 *
 * @example
 * ```ts
 * import { BaseController } from '@formwork/http';
 *
 * class PostsController extends BaseController {
 *   async index() {
 *     return this.json({ ok: true });
 *   }
 * }
 * ```
 */
export abstract class BaseController {
  /**
   * Return a JSON response.
   * @param {unknown} data - Response body
   * @param {number} [status=200] - HTTP status code
   * @returns {CarpenterResponse}
   */
  protected json(data: unknown, status = 200): CarpenterResponse {
    return CarpenterResponse.json(data, status);
  }

  /**
   * Render a view (CarpenterUI page via bridge).
   * @param {string} page - Page component name
   * @param {Dictionary} [props={}] - Page props
   * @returns {ViewResponse}
   */
  protected view(page: string, props: Dictionary = {}): ViewResponse {
    return CarpenterResponse.view(page, props);
  }

  /**
   * Return a redirect response.
   * @param {string} url - Redirect URL
   * @param {number} [status=302] - HTTP status code
   * @returns {CarpenterResponse}
   */
  protected redirect(url: string, status = 302): CarpenterResponse {
    return CarpenterResponse.redirect(url, status);
  }

  /**
   * Return a 404 response.
   * @param {string} [message='Not Found'] - Error message
   * @returns {CarpenterResponse}
   */
  protected notFound(message = "Not Found"): CarpenterResponse {
    return CarpenterResponse.notFound(message);
  }

  /**
   * Return a 204 No Content response.
   * @returns {CarpenterResponse}
   */
  protected noContent(): CarpenterResponse {
    return CarpenterResponse.noContent();
  }

  /**
   * Return a 201 Created response with data.
   * @param {unknown} data - Created resource
   * @returns {CarpenterResponse}
   */
  protected created(data: unknown): CarpenterResponse {
    return CarpenterResponse.json(data, 201);
  }
}
