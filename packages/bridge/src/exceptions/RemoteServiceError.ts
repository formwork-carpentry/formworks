/**
 * @module @formwork/bridge
 * @description Bridge-specific remote call failure.
 */

import { BridgeError } from "./base.js";

/**
 * RemoteServiceError — thrown when a bridge remote call fails.
 *
 * Carries the service, method, machine-readable code, and optional remote details.
 */
export class RemoteServiceError extends BridgeError {
  public readonly service: string;
  public readonly method: string;
  public readonly details?: unknown;

  constructor(message: string, code: string, service: string, method: string, details?: unknown) {
    super(message, code, { service, method, details });
    this.service = service;
    this.method = method;
    this.details = details;
  }
}
