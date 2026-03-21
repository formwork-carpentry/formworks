import type { IContainer } from '@formwork/core/container';
import { ConfigResolver } from '@formwork/core/config';
import { LogManager } from '@formwork/log';
import { EventDispatcher } from '@formwork/events';
import { Validator } from '@formwork/validation';

export class CoreInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  register(): void {
    this.app.singleton('logger', () => new LogManager(this.resolver.logChannel()));
    this.app.singleton('events', () => new EventDispatcher());
    this.app.singleton('validator', () => new Validator());
  }
}
