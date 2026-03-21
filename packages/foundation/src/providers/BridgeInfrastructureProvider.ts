import type { IContainer } from '@formwork/core/container';
import { ConfigResolver } from '@formwork/core/config';
import { createBridgeManager, type BridgeManager } from '@formwork/bridge';

export class BridgeInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  register(): void {
    this.app.singleton('bridge.manager', () => {
      return createBridgeManager(
        this.resolver.bridgeTransport(),
        this.resolver.bridgeTransports() as Record<string, { driver: string }>,
      );
    });

    this.app.singleton('bridge', (c) =>
      (c.make('bridge.manager') as BridgeManager).transport(),
    );
  }
}
