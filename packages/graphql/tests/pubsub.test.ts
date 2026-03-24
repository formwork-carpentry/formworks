import { describe, it, expect, beforeEach } from 'vitest';
import { PubSub } from '../src/PubSub.js';

describe('graphql/PubSub', () => {
  let pubsub: PubSub;

  beforeEach(() => {
    pubsub = new PubSub();
  });

  describe('subscribe and publish', () => {
    it('delivers payload to subscribers', () => {
      const received: unknown[] = [];
      pubsub.subscribe('POST_CREATED', (p) => received.push(p));

      pubsub.publish('POST_CREATED', { id: 1, title: 'Hello' });

      expect(received).toEqual([{ id: 1, title: 'Hello' }]);
    });

    it('delivers to multiple subscribers and isolates topics', () => {
      let count = 0;
      pubsub.subscribe('EVENT', () => count++);
      pubsub.subscribe('EVENT', () => count++);
      pubsub.subscribe('EVENT', () => count++);
      pubsub.subscribe('TOPIC_A', () => {});

      expect(pubsub.publish('EVENT', {})).toBe(3);
      expect(pubsub.publish('TOPIC_B', {})).toBe(0);
      expect(count).toBe(3);
    });
  });

  describe('unsubscribe', () => {
    it('stops receiving after unsubscribe and cleans up topic', () => {
      let count = 0;
      const unsub = pubsub.subscribe('TEMP', () => count++);

      pubsub.publish('TEMP', {});
      expect(count).toBe(1);
      expect(pubsub.getActiveTopics()).toContain('TEMP');

      unsub();
      pubsub.publish('TEMP', {});
      expect(count).toBe(1);
      expect(pubsub.getActiveTopics()).not.toContain('TEMP');
    });
  });

  describe('asyncIterator', () => {
    it('yields published events and supports return()', async () => {
      const iter = pubsub.asyncIterator('STREAM');
      setTimeout(() => pubsub.publish('STREAM', { seq: 1 }), 5);

      const first = await iter.next();
      expect(first.done).toBe(false);
      expect(first.value).toEqual({ seq: 1 });

      await iter.return!();
      const done = await iter.next();
      expect(done.done).toBe(true);
    });

    it('queues events and supports multi-topic subscriptions', async () => {
      const queued = pubsub.asyncIterator('BATCH');
      pubsub.publish('BATCH', { seq: 1 });
      pubsub.publish('BATCH', { seq: 2 });
      expect((await queued.next()).value).toEqual({ seq: 1 });
      expect((await queued.next()).value).toEqual({ seq: 2 });
      await queued.return!();

      const multi = pubsub.asyncIterator(['A', 'B']);
      pubsub.publish('A', { from: 'A' });
      pubsub.publish('B', { from: 'B' });
      const r1 = await multi.next();
      const r2 = await multi.next();
      expect([r1.value, r2.value]).toContainEqual({ from: 'A' });
      expect([r1.value, r2.value]).toContainEqual({ from: 'B' });
      await multi.return!();
    });
  });

  describe('monitoring and errors', () => {
    it('tracks subscribers and publish count', () => {
      pubsub.subscribe('A', () => {});
      pubsub.subscribe('A', () => {});
      pubsub.subscribe('B', () => {});

      pubsub.publish('X', {});
      pubsub.publish('Y', {});
      pubsub.publish('X', {});

      expect(pubsub.getSubscriberCount('A')).toBe(2);
      expect(pubsub.getSubscriberCount('B')).toBe(1);
      expect(pubsub.getSubscriberCount('C')).toBe(0);
      expect(pubsub.getPublishCount()).toBe(3);

      pubsub.clear();
      expect(pubsub.getActiveTopics()).toHaveLength(0);
    });

    it('keeps delivering when one subscriber throws', () => {
      let reached = false;
      pubsub.subscribe('ERR', () => {
        throw new Error('oops');
      });
      pubsub.subscribe('ERR', () => {
        reached = true;
      });

      pubsub.publish('ERR', {});
      expect(reached).toBe(true);
    });
  });
});
