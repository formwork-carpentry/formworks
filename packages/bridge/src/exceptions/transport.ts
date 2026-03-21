/**
 * @module @formwork/bridge
 * @description Transport-specific bridge errors.
 */

import { BridgeError } from "./base.js";

export class BridgeTransportError extends BridgeError {
  constructor(
    message: string,
    code = "BRIDGE_TRANSPORT_ERROR",
    context: Record<string, unknown> = {},
  ) {
    super(message, code, context);
  }
}

export class BridgeTransportNotConnectedError extends BridgeTransportError {
  constructor(transportName: string, message?: string, context: Record<string, unknown> = {}) {
    super(message ?? `${transportName} not connected.`, "BRIDGE_TRANSPORT_NOT_CONNECTED", {
      transportName,
      ...context,
    });
  }
}

export class BridgeDependencyError extends BridgeTransportError {
  constructor(transportName: string, dependency: string, installHint: string) {
    super(
      `${transportName} requires ${dependency}. Install: ${installHint}`,
      "BRIDGE_DEPENDENCY_MISSING",
      { transportName, dependency, installHint },
    );
  }
}

export class BridgeTimeoutError extends BridgeTransportError {
  constructor(timeoutMs: number, target: string) {
    super(`Timeout after ${timeoutMs}ms`, "BRIDGE_TIMEOUT", { timeoutMs, target });
  }
}
