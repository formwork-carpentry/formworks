/**
 * @module @formwork/mail-smtp
 * @description Type definitions for the SMTP mail adapter.
 */

/** Nodemailer-compatible transport interface — allows mock injection */
export interface ISmtpTransport {
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

/** Configuration for SmtpMailAdapter */
export interface SmtpMailConfig {
  /** Default "from" address */
  from?: string;
  /** Default "from" display name */
  fromName?: string;
}
