import type { IContainer } from '@carpentry/formworks/core/container';
import { ConfigResolver } from '@carpentry/formworks/core/config';
import {
  createDatabaseManager,
  type DatabaseConnectionConfig,
  type DatabaseManager,
} from '@carpentry/formworks/db';

export class DatabaseInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  register(): void {
    this.app.singleton('db.manager', () => {
      return createDatabaseManager(
        this.resolver.dbConnection(),
        this.resolver.dbConnections() as Record<string, DatabaseConnectionConfig>,
      );
    });

    this.app.singleton('db', (c) =>
      (c.make('db.manager') as DatabaseManager).connection(),
    );
  }
}
