/**
 * @module @carpentry/mail
 * @description Tests for Mail system (CARP-027)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArrayMailAdapter, LogMailAdapter, BaseMailable } from '../src/adapters/Adapters.js';
import { MailManager, setMailManager, Mail } from '../src/manager/MailManager.js';
import type { MailMessage } from '@carpentry/core/contracts';

// ── Test Mailable ─────────────────────────────────────────

class WelcomeEmail extends BaseMailable {
  constructor(private userName: string) { super(); }

  build(): MailMessage {
    return {
      to: this.mailTo,
      cc: this.mailCc,
      bcc: this.mailBcc,
      subject: `Welcome, ${this.userName}!`,
      html: `<h1>Hello ${this.userName}</h1>`,
    };
  }
}

// ── ArrayMailAdapter ──────────────────────────────────────

describe('CARP-027: ArrayMailAdapter', () => {
  let adapter: ArrayMailAdapter;

  beforeEach(() => { adapter = new ArrayMailAdapter(); });

  it('stores sent messages', async () => {
    await adapter.send({ to: [{ email: 'a@b.com' }], subject: 'Hello', html: '<p>Hi</p>' });
    expect(adapter.getSent()).toHaveLength(1);
  });

  it('assertSentTo() passes when recipient matches', async () => {
    await adapter.send({ to: [{ email: 'alice@ex.com' }], subject: 'Test', html: '' });
    adapter.assertSentTo('alice@ex.com');
  });

  it('assertSentTo() throws when recipient not found', () => {
    expect(() => adapter.assertSentTo('nobody@ex.com')).toThrow();
  });

  it('assertSentWithSubject()', async () => {
    await adapter.send({ to: [{ email: 'a@b.com' }], subject: 'Important', html: '' });
    adapter.assertSentWithSubject('Important');
    expect(() => adapter.assertSentWithSubject('Wrong')).toThrow();
  });

  it('assertCount()', async () => {
    await adapter.send({ to: [{ email: 'a@b.com' }], subject: 'A', html: '' });
    await adapter.send({ to: [{ email: 'b@b.com' }], subject: 'B', html: '' });
    adapter.assertCount(2);
  });

  it('assertNothingSent()', () => {
    adapter.assertNothingSent();
  });

  it('reset() clears sent', async () => {
    await adapter.send({ to: [{ email: 'a@b.com' }], subject: 'A', html: '' });
    adapter.reset();
    adapter.assertNothingSent();
  });
});

// ── LogMailAdapter ────────────────────────────────────────

describe('CARP-027: LogMailAdapter', () => {
  it('logs mail info', async () => {
    const adapter = new LogMailAdapter();
    await adapter.send({ to: [{ email: 'alice@ex.com' }], subject: 'Test', html: '' });
    expect(adapter.getLogs()).toHaveLength(1);
    expect(adapter.getLogs()[0]).toContain('alice@ex.com');
    expect(adapter.getLogs()[0]).toContain('Test');
  });
});

// ── BaseMailable ──────────────────────────────────────────

describe('CARP-027: BaseMailable', () => {
  it('builds a mail message', () => {
    const mail = new WelcomeEmail('Alice').to('alice@ex.com', 'Alice');
    const msg = mail.toMessage();
    expect(msg.subject).toBe('Welcome, Alice!');
    expect(msg.to[0].email).toBe('alice@ex.com');
    expect(msg.html).toContain('Hello Alice');
  });

  it('fluent cc/bcc/replyTo', () => {
    const msg = new WelcomeEmail('Bob')
      .to('bob@ex.com')
      .cc('manager@ex.com')
      .bcc('archive@ex.com')
      .replyTo('noreply@ex.com')
      .toMessage();

    expect(msg.cc![0].email).toBe('manager@ex.com');
    expect(msg.bcc![0].email).toBe('archive@ex.com');
    expect(msg.replyTo!.email).toBe('noreply@ex.com');
  });

  it('fluent subject overrides build()', () => {
    const msg = new WelcomeEmail('Charlie')
      .to('charlie@ex.com')
      .subject('Custom Subject')
      .toMessage();

    expect(msg.subject).toBe('Custom Subject');
  });
});

// ── MailManager ───────────────────────────────────────────

describe('CARP-027: MailManager', () => {
  let manager: MailManager;

  beforeEach(() => {
    manager = new MailManager('array', { array: { driver: 'array' } });
  });

  it('sends via default mailer', async () => {
    await manager.send({ to: [{ email: 'a@b.com' }], subject: 'Hi', html: '' });
    const adapter = manager.mailer() as ArrayMailAdapter;
    adapter.assertCount(1);
  });

  it('sends a mailable', async () => {
    const mailable = new WelcomeEmail('Alice').to('alice@ex.com');
    await manager.sendMailable(mailable);
    const adapter = manager.mailer() as ArrayMailAdapter;
    adapter.assertSentTo('alice@ex.com');
  });

  it('fake() replaces all mailers with ArrayMailAdapter', async () => {
    const fake = manager.fake();
    await manager.send({ to: [{ email: 'a@b.com' }], subject: 'Test', html: '' });
    fake.assertCount(1);
    fake.assertSentTo('a@b.com');
  });

  it('unfake() restores real mailers', async () => {
    const fake = manager.fake();
    await manager.send({ to: [{ email: 'a@b.com' }], subject: 'Faked', html: '' });
    fake.assertCount(1);

    manager.unfake();
    // Now sends via real array adapter again
    await manager.send({ to: [{ email: 'b@b.com' }], subject: 'Real', html: '' });
    // Fake should still have only 1
    fake.assertCount(1);
  });
});

// ── Mail Facade ───────────────────────────────────────────

describe('CARP-027: Mail Facade', () => {
  beforeEach(() => {
    setMailManager(new MailManager('array'));
  });

  it('Mail.send()', async () => {
    await Mail.send({ to: [{ email: 'a@b.com' }], subject: 'Hi', html: '' });
    const adapter = Mail.mailer() as ArrayMailAdapter;
    adapter.assertCount(1);
  });

  it('Mail.fake()', async () => {
    const fake = Mail.fake();
    await Mail.send({ to: [{ email: 'a@b.com' }], subject: 'Faked', html: '' });
    fake.assertSentTo('a@b.com');
    fake.assertSentWithSubject('Faked');
  });
});
