import { describe, it, expect, beforeEach } from 'vitest';
import { SmtpMailAdapter, MockSmtpTransport } from '../../../packages/mail-smtp/src/index.js';

describe('packages/mail/SmtpMailAdapter', () => {
  let transport: MockSmtpTransport;
  let mailer: SmtpMailAdapter;

  beforeEach(() => {
    transport = new MockSmtpTransport();
    mailer = new SmtpMailAdapter(transport, { from: 'noreply@myapp.com', fromName: 'My App' });
  });

  it('sends html and text messages', async () => {
    await mailer.send({ to: 'user@test.com', subject: 'Hello', html: '<p>Hi!</p>' });
    await mailer.send({ to: 'user@test.com', subject: 'Plain', text: 'Hello plain text' });

    expect(transport.getSentMail()).toHaveLength(2);
    expect(transport.getSentMail()[0].subject).toBe('Hello');
    expect(transport.getSentMail()[1].text).toBe('Hello plain text');
  });

  it('tracks sent messages and supports custom from address', async () => {
    await mailer.send({ to: 'a@test.com', subject: 'A' });
    await mailer.send({ to: 'b@test.com', subject: 'B', from: 'custom@other.com' });

    expect(mailer.getSent()).toHaveLength(2);
    expect(transport.getSentMail()[1].from).toBe('custom@other.com');
  });

  it('throws on transport failures', async () => {
    transport.setFail(true);
    await expect(mailer.send({ to: 'fail@test.com', subject: 'Fail' })).rejects.toThrow('SMTP delivery failed');
  });
});
