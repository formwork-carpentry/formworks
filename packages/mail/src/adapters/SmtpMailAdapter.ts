/**
 * @module @carpentry/mail
 * @description SmtpMailAdapter — sends email via SMTP using nodemailer.
 *
 * WHY: HTTP mail APIs (Resend, SendGrid) require vendor accounts and can't send
 * from custom mail servers. SMTP is the universal email protocol — works with
 * any mail server (Postfix, Exchange, Gmail, AWS SES via SMTP).
 *
 * HOW: Wraps nodemailer's createTransport with the IMailAdapter interface.
 * Supports TLS, authentication, and HTML/text/attachments.
 *
 * @patterns Adapter (nodemailer → IMailAdapter)
 * @principles LSP (substitutable for HttpMailAdapter), SRP (SMTP delivery only)
 *
 * @example
 * ```ts
 * import nodemailer from 'nodemailer';
 *
 * const transport = nodemailer.createTransport({
 *   host: 'smtp.example.com',
 *   port: 587,
 *   secure: false,
 *   auth: { user: 'user@example.com', pass: 'password' },
 * });
 *
 * const mailer = new SmtpMailAdapter(transport, { from: 'noreply@example.com' });
 * await mailer.send({ to: 'user@test.com', subject: 'Hello', html: '<p>Hi!</p>' });
 * ```
 */

import type { IMailAdapter, MailMessage } from "@carpentry/core/contracts";

/** Nodemailer-compatible transport interface — allows mock injection */
export interface ISmtpTransport {
  /**
   * @param {SmtpMailOptions} options
   * @returns {Promise<}
   */
  sendMail(options: SmtpMailOptions): Promise<{ messageId?: string; accepted?: string[] }>;
  close?(): void;
}

/** Options passed to nodemailer's sendMail */
export interface SmtpMailOptions {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
}

export interface SmtpMailConfig {
  /** Default "from" address */
  from?: string;
  /** Default "from" display name */
  fromName?: string;
}

/**
 * SmtpMailAdapter — send mail via an SMTP server using a nodemailer-compatible transport.
 *
 * Provide an `ISmtpTransport` (real nodemailer transport or a mock) and optionally
 * configure a default `from` / display name.
 *
 * @example
 * ```ts
 * // With a nodemailer transport (example):
 * const transport = nodemailer.createTransport({
 *   host: 'smtp.example.com',
 *   port: 587,
 *   secure: false,
 *   auth: { user: 'user@example.com', pass: 'password' },
 * });
 *
 * const mailer = new SmtpMailAdapter(transport, { from: 'noreply@example.com', fromName: 'Carpenter' });
 *
 * await mailer.send({
 *   to: [{ email: 'user@example.com' }],
 *   subject: 'Hello',
 *   text: 'Hi!',
 * });
 * ```
 */
export class SmtpMailAdapter implements IMailAdapter {
  private readonly from: string;
  private readonly sent: MailMessage[] = [];

  constructor(
    private readonly transport: ISmtpTransport,
    config: SmtpMailConfig = {},
  ) {
    const name = config.fromName ?? "Carpenter";
    const addr = config.from ?? "noreply@example.com";
    this.from = `${name} <${addr}>`;
  }

  /**
   * @param {MailMessage} message
   * @returns {Promise<void>}
   */
  async send(message: MailMessage): Promise<void> {
    const normalizeAddr = (
      v: string | import("@carpentry/core/contracts").MailAddress[] | undefined,
    ): string | undefined => {
      if (!v) return undefined;
      if (typeof v === "string") return v;
      return v.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", ");
    };
    const toStr = normalizeAddr(message.to) ?? "";
    const options: SmtpMailOptions = {
      from: message.from ?? this.from,
      to: toStr,
      subject: message.subject ?? "",
      html: message.html,
      text: message.text,
    };

    const result = await this.transport.sendMail(options);

    if (!result.accepted || result.accepted.length === 0) {
      throw new Error(`SMTP delivery failed for ${toStr}`);
    }

    this.sent.push(message);
  }

  /** Get all sent messages (for testing) */
  getSent(): MailMessage[] {
    return [...this.sent];
  }

  /** Close the transport connection */
  close(): void {
    this.transport.close?.();
  }
}

/**
 * Mock SMTP transport for testing — no mail server needed.
 * Records all sent messages for assertion.
 *
 * @example
 * ```ts
 * const mock = new MockSmtpTransport();
 * const mailer = new SmtpMailAdapter(mock);
 * await mailer.send({ to: 'test@test.com', subject: 'Hi', text: 'Hello' });
 * expect(mock.getSentMail()).toHaveLength(1);
 * expect(mock.getSentMail()[0].to).toBe('test@test.com');
 * ```
 */
export class MockSmtpTransport implements ISmtpTransport {
  private sentMail: SmtpMailOptions[] = [];
  private shouldFail = false;

  /**
   * @param {SmtpMailOptions} options
   * @returns {Promise<}
   */
  async sendMail(options: SmtpMailOptions): Promise<{ messageId: string; accepted: string[] }> {
    if (this.shouldFail) {
      return { messageId: "", accepted: [] };
    }
    this.sentMail.push(options);
    return {
      messageId: `<mock-${Date.now()}@test>`,
      accepted: [options.to],
    };
  }

  close(): void {}

  /** Get all sent emails */
  getSentMail(): SmtpMailOptions[] {
    return [...this.sentMail];
  }
  /** Clear sent mail log */
  clear(): void {
    this.sentMail = [];
  }
  /** Make next send fail (for error testing) */
  /**
   * @param {boolean} fail
   */
  setFail(fail: boolean): void {
    this.shouldFail = fail;
  }
}
