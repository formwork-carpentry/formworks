import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseNotification, NotificationManager, ArrayChannel, LogChannel, InMemoryDatabaseChannel,
  setNotificationManager, notify, notifyAll,
} from '../src/index.js';
import type { Notifiable, MailChannelMessage, SmsChannelMessage, SlackChannelMessage } from '../src/index.js';

// ── Fixtures ──────────────────────────────────────────────

class TestUser implements Notifiable {
  constructor(
    public id: string,
    public email: string,
    public phone: string,
  ) {}

  routeNotificationFor(channel: string): string | null {
    if (channel === 'mail') return this.email;
    if (channel === 'sms') return this.phone;
    if (channel === 'database') return this.id;
    return null;
  }
}

interface OrderData { orderId: number; total: number; }

class OrderShipped extends BaseNotification<OrderData> {
  via() { return ['mail', 'sms']; }

  toMail(notifiable: Notifiable): MailChannelMessage {
    return {
      to: [{ email: notifiable.routeNotificationFor('mail')! }],
      subject: `Order #${this.data.orderId} shipped`,
      html: `<p>Your order totaling $${this.data.total} has shipped.</p>`,
    };
  }

  toSms(notifiable: Notifiable): SmsChannelMessage {
    return {
      to: notifiable.routeNotificationFor('sms')!,
      body: `Order #${this.data.orderId} shipped!`,
    };
  }
}

class SlackAlert extends BaseNotification<{ message: string }> {
  via() { return ['slack']; }

  toSlack(): SlackChannelMessage {
    return { channel: '#alerts', text: this.data.message };
  }
}

class MultiChannel extends BaseNotification<{ text: string }> {
  via() { return ['mail', 'sms', 'slack', 'database']; }

  toMail(n: Notifiable): MailChannelMessage {
    return { to: [{ email: n.routeNotificationFor('mail')! }], subject: 'Multi', html: this.data.text };
  }
  toSms(n: Notifiable): SmsChannelMessage {
    return { to: n.routeNotificationFor('sms')!, body: this.data.text };
  }
  toSlack() { return { channel: '#general', text: this.data.text } as SlackChannelMessage; }
  toDatabase() { return { type: 'multi', data: { text: this.data.text }, readAt: null }; }
}

// ── Tests ─────────────────────────────────────────────────

describe('@carpentry/notifications: NotificationManager', () => {
  let manager: NotificationManager;
  let mailChannel: ArrayChannel;
  let smsChannel: ArrayChannel;
  let slackChannel: ArrayChannel;
  let alice: TestUser;

  beforeEach(() => {
    mailChannel = new ArrayChannel('mail');
    smsChannel = new ArrayChannel('sms');
    slackChannel = new ArrayChannel('slack');

    manager = new NotificationManager();
    manager.channel('mail', mailChannel);
    manager.channel('sms', smsChannel);
    manager.channel('slack', slackChannel);

    alice = new TestUser('1', 'alice@ex.com', '+1234567890');
  });

  describe('routing', () => {
    it('sends to declared channels', async () => {
      await manager.send(alice, new OrderShipped({ orderId: 42, total: 99.99 }));

      mailChannel.assertCount(1);
      smsChannel.assertCount(1);
      slackChannel.assertNothingSent(); // not in via()
    });

    it('resolves correct message per channel', async () => {
      await manager.send(alice, new OrderShipped({ orderId: 7, total: 50 }));

      const mailMsg = mailChannel.getSent()[0].message as MailChannelMessage;
      expect(mailMsg.subject).toContain('#7');
      expect(mailMsg.to[0].email).toBe('alice@ex.com');

      const smsMsg = smsChannel.getSent()[0].message as SmsChannelMessage;
      expect(smsMsg.to).toBe('+1234567890');
      expect(smsMsg.body).toContain('#7');
    });

    it('sends slack-only notifications', async () => {
      await manager.send(alice, new SlackAlert({ message: 'Server down!' }));

      slackChannel.assertCount(1);
      mailChannel.assertNothingSent();
      smsChannel.assertNothingSent();
    });

    it('throws for unregistered channel', async () => {
      class BadNotif extends BaseNotification { via() { return ['telegram']; } }
      await expect(manager.send(alice, new BadNotif({}))).rejects.toThrow('telegram');
    });
  });

  describe('bulk send', () => {
    it('sends to multiple notifiables', async () => {
      const bob = new TestUser('2', 'bob@ex.com', '+999');
      await manager.sendBulk([alice, bob], new OrderShipped({ orderId: 1, total: 10 }));

      mailChannel.assertCount(2);
      smsChannel.assertCount(2);
    });
  });

  describe('middleware', () => {
    it('before() can block specific channels', async () => {
      manager.before((_n, channel) => channel !== 'sms'); // block SMS

      await manager.send(alice, new OrderShipped({ orderId: 1, total: 10 }));

      mailChannel.assertCount(1);
      smsChannel.assertNothingSent(); // blocked by middleware
    });

    it('before() can block specific notification types', async () => {
      manager.before((n) => !(n instanceof SlackAlert));

      await manager.send(alice, new SlackAlert({ message: 'blocked' }));
      slackChannel.assertNothingSent();

      await manager.send(alice, new OrderShipped({ orderId: 1, total: 10 }));
      mailChannel.assertCount(1); // OrderShipped still goes through
    });
  });

  describe('fake()', () => {
    it('replaces channels with ArrayChannels', async () => {
      const fakes = manager.fake('mail', 'sms');

      await manager.send(alice, new OrderShipped({ orderId: 1, total: 10 }));

      fakes.get('mail')!.assertCount(1);
      fakes.get('sms')!.assertCount(1);
    });

    it('fake() with no args replaces all channels', async () => {
      const fakes = manager.fake();

      await manager.send(alice, new SlackAlert({ message: 'test' }));
      fakes.get('slack')!.assertCount(1);
    });
  });

  describe('4+ channels in one notification', () => {
    it('routes to all declared channels', async () => {
      const dbChannel = new InMemoryDatabaseChannel();
      manager.channel('database', dbChannel);

      await manager.send(alice, new MultiChannel({ text: 'Hello all channels' }));

      mailChannel.assertCount(1);
      smsChannel.assertCount(1);
      slackChannel.assertCount(1);
      expect(dbChannel.getAll()).toHaveLength(1);
    });
  });
});

describe('@carpentry/notifications: LogChannel', () => {
  it('logs notifications', async () => {
    const log = new LogChannel();
    const alice = new TestUser('1', 'a@b.com', '+1');
    await log.send(alice, { subject: 'test' });

    expect(log.getLog()).toHaveLength(1);
    expect(log.getLog()[0].notifiable).toBe(alice);
  });
});

describe('@carpentry/notifications: InMemoryDatabaseChannel', () => {
  let db: InMemoryDatabaseChannel;
  let alice: TestUser;

  beforeEach(() => {
    db = new InMemoryDatabaseChannel();
    alice = new TestUser('user-1', 'a@b.com', '+1');
  });

  it('stores notifications', async () => {
    await db.send(alice, { type: 'order_shipped', data: { orderId: 1 }, readAt: null });
    expect(db.getAll()).toHaveLength(1);
    expect(db.getAll()[0].notifiableId).toBe('user-1');
  });

  it('forNotifiable() filters by user', async () => {
    const bob = new TestUser('user-2', 'b@b.com', '+2');
    await db.send(alice, { type: 'a', data: {}, readAt: null });
    await db.send(bob, { type: 'b', data: {}, readAt: null });

    expect(db.forNotifiable('user-1')).toHaveLength(1);
    expect(db.forNotifiable('user-2')).toHaveLength(1);
  });

  it('unreadFor() and markAsRead()', async () => {
    await db.send(alice, { type: 'a', data: {}, readAt: null });
    await db.send(alice, { type: 'b', data: {}, readAt: null });

    expect(db.unreadFor('user-1')).toHaveLength(2);
    db.markAsRead('user-1');
    expect(db.unreadFor('user-1')).toHaveLength(0);
  });
});

describe('@carpentry/notifications: notify() global helper', () => {
  it('dispatches via global manager', async () => {
    const manager = new NotificationManager();
    const fakeChannel = new ArrayChannel('mail');
    manager.channel('mail', fakeChannel);
    manager.channel('sms', new ArrayChannel('sms'));
    setNotificationManager(manager);

    const alice = new TestUser('1', 'a@b.com', '+1');
    await notify(alice, new OrderShipped({ orderId: 5, total: 25 }));

    fakeChannel.assertCount(1);
  });
});
