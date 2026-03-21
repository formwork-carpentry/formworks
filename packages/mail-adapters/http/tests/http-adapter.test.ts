import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpMailAdapter } from '../src/index.js';

function createMockFetch(status = 200, body: Record<string, unknown> = { id: 'msg_123' }): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    headers: new Headers(),
  }) as unknown as typeof fetch;
}

describe('HttpMailAdapter', () => {
  describe('Resend provider', () => {
    let mockFetch: ReturnType<typeof createMockFetch>;
    let mailer: HttpMailAdapter;

    beforeEach(() => {
      mockFetch = createMockFetch();
      mailer = new HttpMailAdapter({
        provider: 'resend',
        apiKey: 're_test_key',
        from: 'noreply@app.com',
        fetchFn: mockFetch,
      });
    });

    it('should send via Resend API', async () => {
      await mailer.send({ to: 'user@test.com', subject: 'Hi', html: '<p>Hello</p>' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should track sent messages', async () => {
      await mailer.send({ to: 'a@test.com', subject: 'A', text: 'a' });
      expect(mailer.getSent()).toHaveLength(1);
    });

    it('should use Bearer auth for Resend', async () => {
      await mailer.send({ to: 'user@test.com', subject: 'Hi', text: 'hi' });
      const call = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = call[1].headers;
      expect(headers['Authorization']).toBe('Bearer re_test_key');
    });
  });

  describe('SendGrid provider', () => {
    it('should send via SendGrid API', async () => {
      const mockFetch = createMockFetch();
      const mailer = new HttpMailAdapter({
        provider: 'sendgrid',
        apiKey: 'sg_test_key',
        from: 'noreply@app.com',
        fetchFn: mockFetch,
      });
      await mailer.send({ to: 'user@test.com', subject: 'Hi', html: '<p>Hello</p>' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('Postmark provider', () => {
    it('should use X-Postmark-Server-Token header', async () => {
      const mockFetch = createMockFetch();
      const mailer = new HttpMailAdapter({
        provider: 'postmark',
        apiKey: 'pm_test_key',
        fetchFn: mockFetch,
      });
      await mailer.send({ to: 'user@test.com', subject: 'Hi', text: 'hi' });
      const call = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].headers['X-Postmark-Server-Token']).toBe('pm_test_key');
    });
  });

  it('should throw on failed send', async () => {
    const mockFetch = createMockFetch(500, { error: 'bad request' });
    const mailer = new HttpMailAdapter({
      provider: 'resend',
      apiKey: 'key',
      fetchFn: mockFetch,
    });
    await expect(
      mailer.send({ to: 'user@test.com', subject: 'Fail', text: 'x' }),
    ).rejects.toThrow('Mail send failed');
  });

  it('should throw for unknown provider without baseUrl', () => {
    expect(() => new HttpMailAdapter({
      provider: 'unknown' as 'resend',
      apiKey: 'key',
    })).toThrow('Unknown mail provider');
  });

  it('should accept custom baseUrl for unknown provider', () => {
    const mockFetch = createMockFetch();
    const mailer = new HttpMailAdapter({
      provider: 'custom' as 'resend',
      apiKey: 'key',
      baseUrl: 'https://custom-api.com',
      fetchFn: mockFetch,
    });
    expect(mailer).toBeDefined();
  });
});
