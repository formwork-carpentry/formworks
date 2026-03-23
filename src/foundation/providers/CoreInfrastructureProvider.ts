import type { IContainer } from '@carpentry/formworks/core/container';
import { ConfigResolver } from '@carpentry/formworks/core/config';
import { LogManager } from '@carpentry/formworks/log';
import { EventDispatcher } from '@carpentry/formworks/events';
import { Validator } from '@carpentry/formworks/validation';

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
