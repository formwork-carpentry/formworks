/**
 * @module @formwork/core/exceptions
 * @description Service and upstream integration exceptions.
 */

import { CarpenterError } from "./base.js";

/**
 * Upstream / RPC failure with service name and remote error code.
 */
export class RemoteServiceError extends CarpenterError {
  public readonly serviceName: string;
  public readonly remoteCode: string;

  constructor(serviceName: string, message: string, remoteCode = "UNKNOWN") {
    super(message, "REMOTE_SERVICE_ERROR", { serviceName, remoteCode });
    this.serviceName = serviceName;
    this.remoteCode = remoteCode;
  }
}
