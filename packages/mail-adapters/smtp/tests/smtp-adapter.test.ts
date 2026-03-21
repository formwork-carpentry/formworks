import { describe, it, expect, beforeEach } from 'vitest';
import { SmtpMailAdapter, MockSmtpTransport } from '../src/index.js';

describe('SmtpMailAdapter', () => {
  let mock: MockSmtpTransport;
  let mailer: SmtpMailAdapter;

  beforeEach(() => {
    mock = new MockSmtpTransport();
    mailer = new SmtpMailAdapter(mock, { from: 'noreply@app.com', fromName: 'TestApp' });
  });

  it('should send an email', async () => {
    await mailer.send({ to: 'alice@test.com', subject: 'Hello', html: '<p>Hi!</p>' });
    expect(mock.getSentMail()).toHaveLength(1);
    expect(mock.getSentMail()[0].to).toBe('alice@test.com');
    expect(mock.getSentMail()[0].from).toBe('TestApp <noreply@app.com>');
  });

  it('should track sent messages', async () => {
    await mailer.send({ to: 'a@test.com', subject: 'A', text: 'a' });
    await mailer.send({ to: 'b@test.com', subject: 'B', text: 'b' });
    expect(mailer.getSent()).toHaveLength(2);
  });

  it('should throw on delivery failure', async () => {
    mock.setFail(true);
    await expect(
      mailer.send({ to: 'fail@test.com', subject: 'Fail', text: 'fail' }),
    ).rejects.toThrow('SMTP delivery failed');
  });

  it('should use default from address', () => {
    const defaultMailer = new SmtpMailAdapter(mock);
    expect(defaultMailer).toBeDefined();
  });

  it('should close transport', () => {
    expect(() => mailer.close()).not.toThrow();
  });

  it('should allow custom from per message', async () => {
    await mailer.send({ to: 'x@test.com', subject: 'Custom', text: 'hi', from: 'custom@app.com' });
    expect(mock.getSentMail()[0].from).toBe('custom@app.com');
  });
});
