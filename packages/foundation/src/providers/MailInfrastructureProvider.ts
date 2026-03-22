import type { IContainer } from '@formwork/core/container';
import { ConfigResolver } from '@formwork/core/config';
import { createMailManager, type MailManager } from '@formwork/mail';

export class MailInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  register(): void {
    this.app.singleton('mail.manager', () => {
      const from = this.resolver.mailFrom();
      return createMailManager(this.resolver.mailMailer(), this.resolver.mailMailers() as any, {
        fromAddress: from.address,
      });
    });

    this.app.singleton('mail', (c) =>
      (c.make('mail.manager') as MailManager).mailer(),
    );
  }
}
