/**
 * @module @carpentry/foundation/providers/queue
 * @description Registers queue manager and default queue connection bindings.
 */

import type { IDatabaseAdapter } from "@carpentry/formworks/contracts";
import type { ConfigResolver } from "@carpentry/formworks/core/config";
import type { IContainer } from "@carpentry/formworks/core/container";
import {
  type QueueConnectionConfig,
  type QueueManager,
  createQueueManager,
} from "@carpentry/formworks/queue";

/**
 * @description Service provider that wires queue services and database-backed queue dependencies.
 */
export class QueueInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  /**
   * @description Registers queue manager and default connection.
   * @returns {void}
   */
  register(): void {
    this.app.singleton("queue.manager", () => {
      return createQueueManager(
        this.resolver.queueConnection(),
        this.resolver.queueConnections() as Record<string, QueueConnectionConfig>,
        {
          resolveDatabaseAdapter: () => this.app.make("db") as IDatabaseAdapter,
        },
      );
    });

    this.app.singleton("queue", (c) => (c.make("queue.manager") as QueueManager).connection());
  }
}
