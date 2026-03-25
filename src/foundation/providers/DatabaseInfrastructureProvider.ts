/**
 * @module @carpentry/foundation/providers/database
 * @description Registers database manager and default connection bindings.
 */

import type { ConfigResolver } from "@carpentry/formworks/core/config";
import type { IContainer } from "@carpentry/formworks/core/container";
import {
  type DatabaseConnectionConfig,
  type DatabaseManager,
  createDatabaseManager,
} from "@carpentry/formworks/db";

/**
 * @description Service provider that exposes database manager and default adapter.
 *
 * @example
 * ```ts
 * const provider = new DatabaseInfrastructureProvider(container, resolver);
 * provider.register();
 * const db = container.make('db');
 * ```
 */
export class DatabaseInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  /**
   * @description Registers database manager and default connection singletons.
   * @returns {void}
   */
  register(): void {
    this.app.singleton("db.manager", () => {
      return createDatabaseManager(
        this.resolver.dbConnection(),
        this.resolver.dbConnections() as Record<string, DatabaseConnectionConfig>,
      );
    });

    this.app.singleton("db", (c) => (c.make("db.manager") as DatabaseManager).connection());
  }
}
