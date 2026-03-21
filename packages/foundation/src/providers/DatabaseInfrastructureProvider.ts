import type { IContainer } from '@formwork/core/container';
import { ConfigResolver } from '@formwork/core/config';
import {
  createDatabaseManager,
  type DatabaseConnectionConfig,
  type DatabaseManager,
} from '@formwork/db';

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
