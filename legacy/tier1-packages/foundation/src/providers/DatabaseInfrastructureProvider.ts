import type { IContainer } from '@carpentry/core/container';
import { ConfigResolver } from '@carpentry/core/config';
import {
  createDatabaseManager,
  type DatabaseConnectionConfig,
  type DatabaseManager,
} from '@carpentry/db';

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
