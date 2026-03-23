import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryBroadcaster, ChannelManager, setBroadcaster, Broadcast } from '../src/index.js';

describe('@carpentry/realtime: InMemoryBroadcaster', () => {
  let broadcaster: InMemoryBroadcaster;

  beforeEach(() => { broadcaster = new InMemoryBroadcaster(); });

  describe('subscribe/unsubscribe', () => {
    it('tracks subscriptions', () => {
      broadcaster.subscribe('conn-1', 'chat-room');
      broadcaster.subscribe('conn-2', 'chat-room');
      expect(broadcaster.subscriberCount('chat-room')).toBe(2);
    });

    it('unsubscribe removes from channel', () => {
      broadcaster.subscribe('conn-1', 'chat-room');
      broadcaster.unsubscribe('conn-1', 'chat-room');
      expect(broadcaster.subscriberCount('chat-room')).toBe(0);
    });

    it('disconnect removes from all channels', () => {
      broadcaster.subscribe('conn-1', 'channel-a');
      broadcaster.subscribe('conn-1', 'channel-b');
      broadcaster.disconnect('conn-1');
      expect(broadcaster.subscriberCount('channel-a')).toBe(0);
      expect(broadcaster.subscriberCount('channel-b')).toBe(0);
    });

    it('channelsFor() lists a connection\'s channels', () => {
      broadcaster.subscribe('conn-1', 'a');
      broadcaster.subscribe('conn-1', 'b');
      expect(broadcaster.channelsFor('conn-1')).toEqual(['a', 'b']);
    });
  });

  describe('broadcast', () => {
    it('records broadcasted messages', async () => {
      await broadcaster.broadcast('chat', 'message', { text: 'hello' });
      broadcaster.assertBroadcasted('message', 'chat');
      broadcaster.assertBroadcastCount(1);
    });

    it('delivers to subscribers', async () => {
      broadcaster.subscribe('conn-1', 'chat');
      const received: unknown[] = [];
      broadcaster.onMessage('conn-1', (msg) => received.push(msg));

      await broadcaster.broadcast('chat', 'new-message', { text: 'hi' });
      expect(received).toHaveLength(1);
    });

    it('excludeSender skips the sender', async () => {
      broadcaster.subscribe('conn-1', 'chat');
      broadcaster.subscribe('conn-2', 'chat');

      const received1: unknown[] = [];
      const received2: unknown[] = [];
      broadcaster.onMessage('conn-1', (msg) => received1.push(msg));
      broadcaster.onMessage('conn-2', (msg) => received2.push(msg));

      await broadcaster.broadcast('chat', 'typing', {}, 'conn-1');
      expect(received1).toHaveLength(0); // sender excluded
      expect(received2).toHaveLength(1); // others receive
    });

    it('assertNotBroadcasted()', () => {
      broadcaster.assertNotBroadcasted('nothing');
    });
  });

  describe('presence', () => {
    it('tracks presence members', () => {
      broadcaster.subscribe('conn-1', 'presence-room', 1, { name: 'Alice' });
      broadcaster.subscribe('conn-2', 'presence-room', 2, { name: 'Bob' });

      const members = broadcaster.presence('presence-room');
      expect(members).toHaveLength(2);
      expect(members[0].userId).toBe(1);
      expect(members[0].userInfo).toEqual({ name: 'Alice' });
    });

    it('returns empty for non-presence channels', () => {
      broadcaster.subscribe('conn-1', 'public-channel');
      expect(broadcaster.presence('public-channel')).toEqual([]);
    });
  });
});

describe('@carpentry/realtime: ChannelManager', () => {
  let broadcaster: InMemoryBroadcaster;
  let manager: ChannelManager;

  beforeEach(() => {
    broadcaster = new InMemoryBroadcaster();
    manager = new ChannelManager(broadcaster);
  });

  it('public channels always allowed', async () => {
    expect(await manager.canJoin(1, 'public-chat')).toBe(true);
  });

  it('private channels denied by default', async () => {
    expect(await manager.canJoin(1, 'private-orders')).toBe(false);
  });

  it('authorize() allows private channel access', async () => {
    manager.authorize('private-orders.*', (userId) => userId === 1);

    expect(await manager.canJoin(1, 'private-orders.123')).toBe(true);
    expect(await manager.canJoin(2, 'private-orders.123')).toBe(false);
  });

  it('join() subscribes if authorized', async () => {
    manager.authorize('private-chat', () => true);

    const result = await manager.join('conn-1', 'private-chat', 1);
    expect(result).toBe(true);
    expect(broadcaster.subscriberCount('private-chat')).toBe(1);
  });

  it('join() rejects if unauthorized', async () => {
    const result = await manager.join('conn-1', 'private-secret', 1);
    expect(result).toBe(false);
    expect(broadcaster.subscriberCount('private-secret')).toBe(0);
  });

  it('presence channel authorization', async () => {
    manager.authorize('presence-room.{id}', (userId, channel) => {
      const roomId = channel.split('.')[1];
      return roomId === '42'; // only room 42 allowed
    });

    expect(await manager.canJoin(1, 'presence-room.42')).toBe(true);
    expect(await manager.canJoin(1, 'presence-room.99')).toBe(false);
  });
});

describe('@carpentry/realtime: Broadcast facade', () => {
  let broadcaster: InMemoryBroadcaster;

  beforeEach(() => {
    broadcaster = new InMemoryBroadcaster();
    setBroadcaster(broadcaster);
  });

  it('Broadcast.to()', async () => {
    await Broadcast.to('chat', 'message', { text: 'hello' });
    broadcaster.assertBroadcasted('message', 'chat');
  });

  it('Broadcast.toOthers()', async () => {
    await Broadcast.toOthers('chat', 'typing', {}, 1);
    expect(broadcaster.getBroadcasted()[0].sender).toBe(1);
  });

  it('Broadcast.presence()', () => {
    broadcaster.subscribe('conn-1', 'room', 1, { name: 'Alice' });
    const members = Broadcast.presence('room');
    expect(members).toHaveLength(1);
  });
});
