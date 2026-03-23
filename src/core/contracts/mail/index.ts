/**
 * @module @carpentry/core/contracts/mail
 * @description Mail adapter contract - all mail drivers implement this interface.
 *
 * Implementations: ArrayMailAdapter, LogMailAdapter, HttpMailAdapter, SmtpMailAdapter
 *
 * @example
 * ```ts
 * const mailer = container.make<IMailAdapter>('mail');
 * await mailer.send({ to: 'user@test.com', subject: 'Welcome!', html: '<p>Hello!</p>' });
 * ```
 */

export interface MailAddress {
  email: string;
  name?: string;
}

export type MailRecipient = string | MailAddress[];

/** @typedef {Object} MailMessage - Email message structure */
export interface MailMessage {
  /** @property {string | MailAddress[]} to - Recipient email address(es) */
  to: MailRecipient;
  /** @property {string} [from] - Sender address (overrides default) */
  from?: string;
  /** @property {string} [subject] - Email subject line */
  subject?: string;
  /** @property {string} [html] - HTML body */
  html?: string;
  /** @property {string} [text] - Plain text body */
  text?: string;
  /** @property {string | MailAddress[]} [cc] - CC recipients */
  cc?: MailRecipient;
  /** @property {string | MailAddress[]} [bcc] - BCC recipients */
  bcc?: MailRecipient;
  /** @property {string | MailAddress} [replyTo] - Reply-to address */
  replyTo?: string | MailAddress;
}

/** @typedef {Object} IMailAdapter - Mail adapter contract */
export interface IMailAdapter {
  /**
   * Send an email message.
   * @param {MailMessage} message - The email to send
   * @returns {Promise<void>}
   * @throws {Error} If delivery fails
   * @example
   * ```ts
   * await mailer.send({
   *   to: 'user@test.com',
   *   subject: 'Welcome!',
   *   html: '<h1>Welcome to our app</h1>',
   * });
   * ```
   */
  send(message: MailMessage): Promise<void>;
}
