/**
 * @module @carpentry/mail-smtp
 * @description Mock SMTP transport for testing — no mail server needed.
 *
 * @example
 * ```ts
 * import { SmtpMailAdapter, MockSmtpTransport } from '@carpentry/mail-smtp';
 * const mock = new MockSmtpTransport();
 * const mailer = new SmtpMailAdapter(mock);
 * await mailer.send({ to: 'test@test.com', subject: 'Hi', text: 'Hello' });
 * expect(mock.getSentMail()).toHaveLength(1);
 * ```
 */

import type { ISmtpTransport, SmtpMailOptions } from './types.js';

/** In-memory mock that implements the ISmtpTransport interface for testing. */
export class MockSmtpTransport implements ISmtpTransport {
  private sentMail: SmtpMailOptions[] = [];
  private shouldFail = false;

  async sendMail(options: SmtpMailOptions): Promise<{ messageId: string; accepted: string[] }> {
    if (this.shouldFail) {
      return { messageId: '', accepted: [] };
    }
    this.sentMail.push(options);
    return {
      messageId: `<mock-${Date.now()}@test>`,
      accepted: [options.to],
    };
  }

  close(): void {}

  getSentMail(): SmtpMailOptions[] { return [...this.sentMail]; }
  clear(): void { this.sentMail = []; }
  setFail(fail: boolean): void { this.shouldFail = fail; }
}
