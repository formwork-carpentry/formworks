import type { IContainer } from '@carpentry/core/container';
import { ConfigResolver } from '@carpentry/core/config';
import { LogManager } from '@carpentry/log';
import { EventDispatcher } from '@carpentry/events';
import { Validator } from '@carpentry/validation';

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
