/**
 * @module @carpentry/foundation/providers/core
 * @description Registers core singleton services such as logger, events, and validator.
 */

import type { ConfigResolver } from "@carpentry/formworks/core/config";
import type { IContainer } from "@carpentry/formworks/core/container";
import { EventDispatcher } from "@carpentry/formworks/events";
import { LogManager } from "@carpentry/formworks/log";
import { Validator } from "@carpentry/formworks/validation";

/**
 * @description Service provider that wires core framework services into the IoC container.
 *
 * @example
 * ```ts
 * const provider = new CoreInfrastructureProvider(container, resolver);
 * provider.register();
 * const events = container.make('events');
 * ```
 */
export class CoreInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  /**
   * @description Registers core singletons used by the runtime.
   * @returns {void}
   */
  register(): void {
    this.app.singleton("logger", () => new LogManager(this.resolver.logChannel()));
    this.app.singleton("events", () => new EventDispatcher());
    this.app.singleton("validator", () => new Validator());
  }
}
