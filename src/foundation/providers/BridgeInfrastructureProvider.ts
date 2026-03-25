/**
 * @module @carpentry/foundation/providers/bridge
 * @description Registers bridge manager and default transport bindings.
 */

import { type BridgeManager, createBridgeManager } from "@carpentry/formworks/bridge";
import type { ConfigResolver } from "@carpentry/formworks/core/config";
import type { IContainer } from "@carpentry/formworks/core/container";

/**
 * @description Service provider that wires microservice bridge transports into IoC.
 */
export class BridgeInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  /**
   * @description Registers bridge manager and default transport instance.
   * @returns {void}
   */
  register(): void {
    this.app.singleton("bridge.manager", () => {
      return createBridgeManager(
        this.resolver.bridgeTransport(),
        this.resolver.bridgeTransports() as Record<string, { driver: string }>,
      );
    });

    this.app.singleton("bridge", (c) => (c.make("bridge.manager") as BridgeManager).transport());
  }
}
