import type { IContainer } from '@carpentry/formworks/core/container';
import { ConfigResolver } from '@carpentry/formworks/core/config';
import { createBridgeManager, type BridgeManager } from '@carpentry/formworks/bridge';

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
