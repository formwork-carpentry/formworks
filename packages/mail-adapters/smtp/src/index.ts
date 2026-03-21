/**
 * @module @formwork/mail-smtp
 * @description SmtpMailAdapter — sends email via SMTP using nodemailer.
 *
 * @patterns Adapter (nodemailer → IMailAdapter)
 * @principles LSP (substitutable for HttpMailAdapter), SRP (SMTP delivery only)
 *
 * @example
 * ```ts
 * import { SmtpMailAdapter, MockSmtpTransport } from '@formwork/mail-smtp';
 *
 * const mock = new MockSmtpTransport();
 * const mailer = new SmtpMailAdapter(mock, { from: 'noreply@example.com' });
 * await mailer.send({ to: 'user@test.com', subject: 'Hello', html: '<p>Hi!</p>' });
 * ```
 */

import type { IMailAdapter, MailMessage } from '@formwork/core/contracts';
import type { ISmtpTransport, SmtpMailOptions, SmtpMailConfig } from './types.js';

export { type ISmtpTransport, type SmtpMailOptions, type SmtpMailConfig } from './types.js';
export { MockSmtpTransport } from './MockSmtpTransport.js';

/**
 * SmtpMailAdapter — send mail via an SMTP server using a nodemailer-compatible transport.
 */
export class SmtpMailAdapter implements IMailAdapter {
  private readonly from: string;
  private readonly sent: MailMessage[] = [];

  constructor(
    private readonly transport: ISmtpTransport,
    config: SmtpMailConfig = {},
  ) {
    const name = config.fromName ?? 'Carpenter';
    const addr = config.from ?? 'noreply@example.com';
    this.from = `${name} <${addr}>`;
  }

  async send(message: MailMessage): Promise<void> {
    const normalizeAddr = (v: string | import('@formwork/core/contracts').MailAddress[] | undefined): string | undefined => {
      if (!v) return undefined;
      if (typeof v === 'string') return v;
      return v.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(', ');
    };
    const toStr = normalizeAddr(message.to) ?? '';
    const options: SmtpMailOptions = {
      from: message.from ?? this.from,
      to: toStr,
      subject: message.subject ?? '',
      html: message.html,
      text: message.text,
      cc: normalizeAddr(message.cc),
      bcc: normalizeAddr(message.bcc),
    };

    const result = await this.transport.sendMail(options);

    if (!result.accepted || result.accepted.length === 0) {
      throw new Error(`SMTP delivery failed for ${toStr}`);
    }

    this.sent.push(message);
  }

  getSent(): MailMessage[] { return [...this.sent]; }

  close(): void { this.transport.close?.(); }
}

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@formwork/core/adapters';

/**
 * Create a MailManager-compatible driver factory for the SMTP adapter.
 *
 * @param transportFactory - Callback that creates an `ISmtpTransport` from config.
 * @returns A `DriverFactory` to pass to `MailManager.registerDriver('smtp', …)`.
 *
 * @example
 * ```ts
 * import nodemailer from 'nodemailer';
 * import { createSmtpMailDriverFactory } from '@formwork/mail-smtp';
 *
 * mailManager.registerDriver('smtp', createSmtpMailDriverFactory(
 *   (cfg) => nodemailer.createTransport({ host: cfg['host'], port: cfg['port'] }),
 * ));
 * ```
 */
export function createSmtpMailDriverFactory(
  transportFactory: (config: Record<string, unknown>) => ISmtpTransport,
): CarpenterFactoryAdapter {
  return (config: { driver: string; [key: string]: unknown }) =>
    new SmtpMailAdapter(transportFactory(config), config as SmtpMailConfig);
}
