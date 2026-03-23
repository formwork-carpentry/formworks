import type { IContainer } from '@carpentry/core/container';
import { ConfigResolver } from '@carpentry/core/config';
import type { IDatabaseAdapter } from '@carpentry/core/contracts';
import { createQueueManager, type QueueManager } from '@carpentry/queue';

export class QueueInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  register(): void {
    this.app.singleton('queue.manager', () => {
      return createQueueManager(
        this.resolver.queueConnection(),
        this.resolver.queueConnections() as any,
        {
          resolveDatabaseAdapter: () => this.app.make('db') as IDatabaseAdapter,
        },
      );
    });

    this.app.singleton('queue', (c) =>
      (c.make('queue.manager') as QueueManager).connection(),
    );
  }
}
