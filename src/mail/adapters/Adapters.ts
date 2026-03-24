/**
 * @module @carpentry/mail
 * @description Mail adapters — Array (testing assertions), Log (dev console output)
 * @patterns Adapter, Template Method (BaseMailable)
 * @principles LSP — all adapters substitutable; SRP — each adapter handles one transport
 */

import type { IMailAdapter, MailAddress, MailMessage } from "@carpentry/formworks/contracts";

// ── ArrayMailAdapter — stores sent mails for testing ──────

/**
 * ArrayMailAdapter — stores all sent mail messages in memory.
 *
 * Intended for tests and local development:
 * - use `getSent()` to inspect messages
 * - use `assertSentTo()`, `assertSentWithSubject()`, and `assertCount()` for assertions
 *
 * @example
 * ```ts
 * const adapter = new ArrayMailAdapter();
 *
 * await adapter.send({
 *   to: [{ email: 'user@example.com' }],
 *   subject: 'Welcome',
 *   text: 'Hello from Carpenter!',
 * });
 *
 * adapter.assertSentTo('user@example.com');
 * adapter.assertSentWithSubject('Welcome');
 * adapter.assertCount(1);
 * ```
 */
export class ArrayMailAdapter implements IMailAdapter {
  private sent: MailMessage[] = [];

  /**
   * @param {MailMessage} message
   * @returns {Promise<void>}
   */
  async send(message: MailMessage): Promise<void> {
    this.sent.push({ ...message });
  }

  /** Get all sent messages */
  getSent(): MailMessage[] {
    return [...this.sent];
  }

  /** Assert a mail was sent to a specific address */
  /**
   * @param {string} email
   */
  assertSentTo(email: string): void {
    const toEmails = (to: string | MailAddress[]) =>
      Array.isArray(to) ? to.map((a) => a.email) : [to];
    const found = this.sent.some((m) => toEmails(m.to).includes(email));
    if (!found) {
      const recipients = this.sent.flatMap((m) => toEmails(m.to)).join(", ");
      throw new Error(`Expected mail to "${email}" but none found. Sent to: [${recipients}]`);
    }
  }

  /** Assert a mail was sent with specific subject */
  /**
   * @param {string} subject
   */
  assertSentWithSubject(subject: string): void {
    const found = this.sent.some((m) => m.subject === subject);
    if (!found) {
      const subjects = this.sent.map((m) => m.subject).join(", ");
      throw new Error(`Expected mail with subject "${subject}". Found: [${subjects}]`);
    }
  }

  /** Assert exact count of mails sent */
  /**
   * @param {number} count
   */
  assertCount(count: number): void {
    if (this.sent.length !== count) {
      throw new Error(`Expected ${count} mails sent, found ${this.sent.length}.`);
    }
  }

  /** Assert nothing was sent */
  assertNothingSent(): void {
    if (this.sent.length > 0) {
      throw new Error(`Expected no mails sent, but ${this.sent.length} were sent.`);
    }
  }

  /** Reset sent messages */
  reset(): void {
    this.sent = [];
  }
}

// ── LogMailAdapter — logs to console instead of sending ───

/**
 * LogMailAdapter — logs mail deliveries and keeps an in-memory log.
 *
 * Useful for development environments where you want to verify payloads
 * without setting up an SMTP/HTTP provider.
 *
 * @example
 * ```ts
 * const adapter = new LogMailAdapter();
 *
 * await adapter.send({
 *   to: [{ email: 'user@example.com' }],
 *   subject: 'Ping',
 *   text: 'Hello',
 * });
 *
 * const logs = adapter.getLogs();
 * // logs[0] includes "[MAIL] To: user@example.com | Subject: Ping"
 * ```
 */
export class LogMailAdapter implements IMailAdapter {
  private logs: string[] = [];

  /**
   * @param {MailMessage} message
   * @returns {Promise<void>}
   */
  async send(message: MailMessage): Promise<void> {
    const to = Array.isArray(message.to) ? message.to.map((a) => a.email).join(", ") : message.to;
    const entry = `[MAIL] To: ${to} | Subject: ${message.subject}`;
    this.logs.push(entry);
  }

  getLogs(): string[] {
    return [...this.logs];
  }
  reset(): void {
    this.logs = [];
  }
}

// ── BaseMailable — Template Method for building mails ─────

export abstract class BaseMailable {
  protected mailTo: MailAddress[] = [];
  protected mailCc: MailAddress[] = [];
  protected mailBcc: MailAddress[] = [];
  protected mailSubject = "";
  protected mailReplyTo?: MailAddress;

  /** Override to configure the mailable */
  abstract build(): MailMessage;

  /**
   * Build a concrete `MailMessage` by combining fluent targeting fields with your implementation
   * of {@link BaseMailable.build}.
   *
   * `toMessage()` copies:
   * - `to` from the fluent `to()` calls (if any) else from `build().to`
   * - `subject` from fluent `subject()` (if set) else from `build().subject`
   * - `replyTo` from fluent `replyTo()` (if set) else from `build().replyTo`
   *
   * @example
   * ```ts
   * import type { MailMessage } from '..';
   * import { BaseMailable } from '..';
   *
   * class WelcomeMail extends BaseMailable {
   *   constructor(private name: string) { super(); }
   *
   *   build(): MailMessage {
   *     return {
   *       to: [],
   *       subject: 'Welcome',
   *       text: `Hello ${this.name}`,
   *     };
   *   }
   * }
   *
   * const msg = new WelcomeMail('Alice')
   *   .to('user@example.com')
   *   .subject('Welcome');
   *
   * // msg.toMessage().text === 'Hello Alice'
   * ```
   */

  /**
   * @param {string} email
   * @param {string} [name]
   * @returns {this}
   */
  to(email: string, name?: string): this {
    this.mailTo.push({ email, name });
    return this;
  }

  /**
   * @param {string} email
   * @param {string} [name]
   * @returns {this}
   */
  cc(email: string, name?: string): this {
    this.mailCc.push({ email, name });
    return this;
  }

  /**
   * @param {string} email
   * @param {string} [name]
   * @returns {this}
   */
  bcc(email: string, name?: string): this {
    this.mailBcc.push({ email, name });
    return this;
  }

  /**
   * @param {string} subject
   * @returns {this}
   */
  subject(subject: string): this {
    this.mailSubject = subject;
    return this;
  }

  /**
   * @param {string} email
   * @param {string} [name]
   * @returns {this}
   */
  replyTo(email: string, name?: string): this {
    this.mailReplyTo = { email, name };
    return this;
  }

  /** Get the final mail message — calls build() and merges fluent settings */
  toMessage(): MailMessage {
    const built = this.build();
    return {
      ...built,
      to: this.mailTo.length > 0 ? this.mailTo : built.to,
      cc: this.mailCc.length > 0 ? this.mailCc : built.cc,
      bcc: this.mailBcc.length > 0 ? this.mailBcc : built.bcc,
      subject: this.mailSubject || built.subject,
      replyTo: this.mailReplyTo ?? built.replyTo,
    };
  }
}
