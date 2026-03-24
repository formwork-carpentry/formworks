import { describe, it, expect } from 'vitest';
import { HttpMailAdapter } from '../../src/mail/adapters/HttpMailAdapter.js';

function createMockFetch(status: number, body: Record<string, unknown> = {}): typeof fetch {
  return async (_url: string | URL | Request, _init?: RequestInit) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

describe('mail/HttpMailAdapter', () => {
  it('sends via resend and records sent messages', async () => {
    const mailer = new HttpMailAdapter({
      provider: 'resend',
      apiKey: 're_test_key',
      from: 'noreply@example.com',
      fetchFn: createMockFetch(200, { id: 'msg_123' }),
    });

    await mailer.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hello</p>' });
    expect(mailer.getSent()).toHaveLength(1);
    expect(mailer.getSent()[0].to).toBe('user@example.com');
  });

  it('handles resend failures and network errors', async () => {
    const unauthorized = new HttpMailAdapter({
      provider: 'resend',
      apiKey: 'bad_key',
      fetchFn: createMockFetch(401, { error: 'Unauthorized' }),
    });

    await expect(unauthorized.send({ to: 'x@x.com', subject: 'X', html: '' })).rejects.toThrow('Mail send failed');

    const networkFail = new HttpMailAdapter({
      provider: 'resend',
      apiKey: 'x',
      fetchFn: async () => {
        throw new Error('Network error');
      },
    });

    await expect(networkFail.send({ to: 'x@x.com', subject: 'X', text: '' })).rejects.toThrow('Mail send failed');
  });

  it('supports sendgrid and postmark payload/header formats', async () => {
    let sendgridBody: Record<string, unknown> | null = null;
    const sendgrid = new HttpMailAdapter({
      provider: 'sendgrid',
      apiKey: 'sg_key',
      from: 'sender@example.com',
      fetchFn: async (_url, init) => {
        sendgridBody = JSON.parse(init?.body as string);
        return new Response('{}', { status: 202 });
      },
    });

    await sendgrid.send({ to: 'user@test.com', subject: 'Hi', html: '<b>Hello</b>' });
    expect(sendgridBody).toHaveProperty('personalizations');
    expect(sendgridBody).toHaveProperty('from');

    let postmarkHeaders: Record<string, string> = {};
    const postmark = new HttpMailAdapter({
      provider: 'postmark',
      apiKey: 'pm_token',
      fetchFn: async (_url, init) => {
        postmarkHeaders = Object.fromEntries(Object.entries(init?.headers ?? {}));
        return new Response('{"MessageID":"abc"}', { status: 200 });
      },
    });

    await postmark.send({ to: 'a@b.com', subject: 'Test', text: 'Hello' });
    expect(postmarkHeaders['X-Postmark-Server-Token']).toBe('pm_token');
  });

  it('requires baseUrl for custom provider and works when provided', async () => {
    expect(() => new HttpMailAdapter({ provider: 'custom', apiKey: 'x' })).toThrow('no baseUrl');

    const custom = new HttpMailAdapter({
      provider: 'custom',
      apiKey: 'x',
      baseUrl: 'https://mail.internal.corp/api',
      fetchFn: createMockFetch(200, { ok: true }),
    });

    await custom.send({ to: 'user@corp.com', subject: 'Internal', text: 'Hi' });
    expect(custom.getSent()).toHaveLength(1);
  });
});
