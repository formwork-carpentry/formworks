/**
 * @module @carpentry/mail-http
 * @description Type definitions for the HTTP mail adapter.
 */

export type HttpMailProvider = 'mailgun' | 'resend' | 'sendgrid' | 'postmark' | 'custom';

export interface HttpMailConfig {
  /** Which provider to use */
  provider: HttpMailProvider;
  /** API key for the mail provider */
  apiKey: string;
  /** API base URL (auto-configured for known providers, required for 'custom') */
  baseUrl?: string;
  /** Default from address */
  from?: string;
  /** Custom headers to include with every API request */
  headers?: Record<string, string>;
  /** Custom fetch implementation (for testing) */
  fetchFn?: typeof fetch;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  statusCode?: number;
}
