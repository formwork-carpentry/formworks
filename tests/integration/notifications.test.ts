import { describe, it, expect } from 'vitest';
import { NotificationManager, ArrayChannel as NotifArrayChannel } from '../../src/notifications/index.js';
import type { MailChannelMessage } from '../../src/notifications/index.js';
import { NotifiableUser, WelcomeNotification } from './support.js';

describe('integration/notifications', () => {
  it('dispatches notifications across channels', async () => {
    const mailChannel = new NotifArrayChannel('mail');
    const smsChannel = new NotifArrayChannel('sms');

    const notifManager = new NotificationManager();
    notifManager.channel('mail', mailChannel).channel('sms', smsChannel);

    const user = new NotifiableUser(1, 'alice@example.com', '+1234567890');
    await notifManager.send(user, new WelcomeNotification({ name: 'Alice' }));

    mailChannel.assertCount(1);
    smsChannel.assertCount(1);

    const mailMsg = mailChannel.getSent()[0].message as MailChannelMessage;
    expect(mailMsg.subject).toContain('Alice');
    expect(mailMsg.to[0].email).toBe('alice@example.com');
  });
});
