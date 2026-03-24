/**
 * @module @carpentry/mail-http
 * @description HttpMailAdapter — sends mail via HTTP API (Mailgun, Resend, SendGrid, Postmark).
 *
 * @patterns Adapter (implements IMailAdapter), Strategy (provider-specific config)
 * @principles LSP (substitutable for SmtpMailAdapter), SRP (HTTP mail dispatch only)
 *
 * @example
 * ```ts
 * import { HttpMailAdapter } from '@carpentry/mail-http';
 *
 * const mailer = new HttpMailAdapter({
 *   provider: 'resend',
 *   apiKey: 're_xxx',
 *   from: 'noreply@example.com',
 * });
 * await mailer.send({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi!</p>' });
 * ```
 */

import type { IMailAdapter, MailMessage } from '@carpentry/core/contracts';
import type { HttpMailConfig, SendResult } from './types.js';

export { type HttpMailConfig, type HttpMailProvider, type SendResult } from './types.js';

const PROVIDER_URLS: Record<string, string> = {
  mailgun: 'https://api.mailgun.net/v3',
  resend: 'https://api.resend.com',
  sendgrid: 'https://api.sendgrid.com/v3/mail/send',
  postmark: 'https://api.postmarkapp.com',
};

/** HTTP-based mail adapter. Sends mail by calling a provider's REST API. */
export class HttpMailAdapter implements IMailAdapter {
  private readonly config: HttpMailConfig;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly sent: MailMessage[] = [];

  constructor(config: HttpMailConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? PROVIDER_URLS[config.provider] ?? '';
    this.fetchFn = config.fetchFn ?? globalThis.fetch;

    if (!this.baseUrl) {
      throw new Error(`Unknown mail provider "${config.provider}" and no baseUrl provided.`);
    }
  }

  async send(message: MailMessage): Promise<void> {
    const result = await this.dispatch(message);
    this.sent.push(message);

    if (!result.success) {
      throw new Error(`Mail send failed: ${result.error} (${result.provider})`);
    }
  }

  getSent(): MailMessage[] { return [...this.sent]; }

  private async dispatch(message: MailMessage): Promise<SendResult> {
    const body = this.buildRequestBody(message);
    const headers = this.buildHeaders();

    try {
      const url = this.buildUrl();
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({})) as Record<string, unknown>;

      return {
        success: response.ok,
        messageId: (data['id'] ?? data['messageId'] ?? data['MessageID']) as string | undefined,
        error: response.ok ? undefined : JSON.stringify(data),
        provider: this.config.provider,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        provider: this.config.provider,
      };
    }
  }

  private buildUrl(): string {
    switch (this.config.provider) {
      case 'resend': return `${this.baseUrl}/emails`;
      case 'sendgrid': return this.baseUrl;
      case 'postmark': return `${this.baseUrl}/email`;
      case 'mailgun': return `${this.baseUrl}/messages`;
      default: return this.baseUrl;
    }
  }

  private buildRequestBody(message: MailMessage): Record<string, unknown> {
    const from = message.from ?? this.config.from ?? 'noreply@example.com';

    switch (this.config.provider) {
      case 'resend':
        return { from, to: [message.to], subject: message.subject, html: message.html, text: message.text };
      case 'sendgrid':
        return {
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: from },
          subject: message.subject,
          content: [
            ...(message.text ? [{ type: 'text/plain', value: message.text }] : []),
            ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
          ],
        };
      case 'postmark':
        return { From: from, To: message.to, Subject: message.subject, HtmlBody: message.html, TextBody: message.text };
      default:
        return { from, to: message.to, subject: message.subject, html: message.html, text: message.text };
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    switch (this.config.provider) {
      case 'resend':
      case 'sendgrid':
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        break;
      case 'postmark':
        headers['X-Postmark-Server-Token'] = this.config.apiKey;
        break;
      case 'mailgun':
        headers['Authorization'] = `Basic ${btoa(`api:${this.config.apiKey}`)}`;
        break;
      default:
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }
}

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';

/**
 * MailManager-compatible driver factory for the HTTP mail adapter.
 * Supports known providers: mailgun, resend, sendgrid, postmark.
 *
 * Config must include `apiKey` and may include `from`, `baseUrl`.
 *
 * @example
 * ```ts
 * import { httpMailDriverFactory } from '@carpentry/mail-http';
 *
 * mailManager.registerDriver('resend', httpMailDriverFactory('resend'));
 * mailManager.registerDriver('sendgrid', httpMailDriverFactory('sendgrid'));
 * ```
 */
export function httpMailDriverFactory(provider: string): CarpenterFactoryAdapter {
  return (config: { driver: string; [key: string]: unknown }) =>
    new HttpMailAdapter({
      provider: provider as HttpMailConfig['provider'],
      apiKey: config['apiKey'] as string ?? '',
      from: config['from'] as string | undefined,
      baseUrl: config['baseUrl'] as string | undefined,
      headers: config['headers'] as Record<string, string> | undefined,
    });
}
