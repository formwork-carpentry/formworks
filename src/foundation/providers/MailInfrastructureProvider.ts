/**
 * @module @carpentry/foundation/providers/mail
 * @description Registers mail manager and default mailer bindings.
 */

import type { IContainer } from '@carpentry/formworks/core/container';
import { ConfigResolver } from '@carpentry/formworks/core/config';
import {
  createMailManager,
  type MailDriverConfig,
  type MailManager,
} from '@carpentry/formworks/mail';

/**
 * @description Service provider that wires framework mail delivery services.
 */
export class MailInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  /**
   * @description Registers mail manager and default mailer.
   * @returns {void}
   */
  register(): void {
    this.app.singleton('mail.manager', () => {
      const from = this.resolver.mailFrom();
      return createMailManager(
        this.resolver.mailMailer(),
        this.resolver.mailMailers() as Record<string, MailDriverConfig>,
        {
          fromAddress: from.address,
        },
      );
    });

    this.app.singleton('mail', (c) =>
      (c.make('mail.manager') as MailManager).mailer(),
    );
  }
}
