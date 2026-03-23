/**
 * @module @carpentry/events
 * @description Tests for EventDispatcher and EventFake (CARP-032)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventDispatcher, EventFake } from '../src/dispatcher/EventDispatcher.js';
import type { IEventDispatcher } from '@carpentry/core/contracts';

describe('CARP-032: EventDispatcher', () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    dispatcher = new EventDispatcher();
  });

  describe('on() and emit()', () => {
    it('fires listener when event emitted', async () => {
      let received: unknown = null;
      dispatcher.on('user.registered', (payload) => { received = payload; });

      await dispatcher.emit('user.registered', { id: 1, name: 'Alice' });

      expect(received).toEqual({ id: 1, name: 'Alice' });
    });

    it('fires multiple listeners in registration order', async () => {
      const order: number[] = [];
      dispatcher.on('event', () => { order.push(1); });
      dispatcher.on('event', () => { order.push(2); });
      dispatcher.on('event', () => { order.push(3); });

      await dispatcher.emit('event');

      expect(order).toEqual([1, 2, 3]);
    });

    it('does nothing when no listeners registered', async () => {
      // Should not throw
      await dispatcher.emit('unhandled.event', { data: true });
    });

    it('handles async listeners', async () => {
      let value = '';
      dispatcher.on('async.event', async () => {
        await new Promise((r) => setTimeout(r, 10));
        value = 'done';
      });

      await dispatcher.emit('async.event');
      expect(value).toBe('done');
    });
  });

  describe('once()', () => {
    it('fires listener only once', async () => {
      let count = 0;
      dispatcher.once('event', () => { count++; });

      await dispatcher.emit('event');
      await dispatcher.emit('event');
      await dispatcher.emit('event');

      expect(count).toBe(1);
    });

    it('once listener removed after first emit', async () => {
      dispatcher.once('event', () => {});
      expect(dispatcher.hasListeners('event')).toBe(true);

      await dispatcher.emit('event');
      expect(dispatcher.hasListeners('event')).toBe(false);
    });
  });

  describe('off()', () => {
    it('removes specific listener', async () => {
      let count = 0;
      const listener = () => { count++; };
      dispatcher.on('event', listener);
      dispatcher.off('event', listener);

      await dispatcher.emit('event');
      expect(count).toBe(0);
    });

    it('removes all listeners when no specific listener given', async () => {
      dispatcher.on('event', () => {});
      dispatcher.on('event', () => {});
      expect(dispatcher.hasListeners('event')).toBe(true);

      dispatcher.off('event');
      expect(dispatcher.hasListeners('event')).toBe(false);
    });
  });

  describe('unsubscribe (return value from on)', () => {
    it('on() returns unsubscribe function', async () => {
      let count = 0;
      const unsub = dispatcher.on('event', () => { count++; });

      await dispatcher.emit('event');
      expect(count).toBe(1);

      unsub();
      await dispatcher.emit('event');
      expect(count).toBe(1); // not called again
    });

    it('once() returns unsubscribe function', async () => {
      let count = 0;
      const unsub = dispatcher.once('event', () => { count++; });
      unsub();

      await dispatcher.emit('event');
      expect(count).toBe(0);
    });
  });

  describe('wildcard listeners', () => {
    it('user.* matches user.registered and user.deleted', async () => {
      const events: string[] = [];
      dispatcher.on('user.*', (payload) => {
        events.push('wildcard');
      });

      await dispatcher.emit('user.registered', {});
      await dispatcher.emit('user.deleted', {});
      await dispatcher.emit('order.placed', {}); // should NOT match

      expect(events).toEqual(['wildcard', 'wildcard']);
    });

    it('wildcard does not match exact prefix without dot', async () => {
      let called = false;
      dispatcher.on('user.*', () => { called = true; });

      await dispatcher.emit('username', {}); // should NOT match 'user.*'
      expect(called).toBe(false);
    });
  });

  describe('listeners() and hasListeners()', () => {
    it('listeners() returns registered handlers', () => {
      const fn1 = () => {};
      const fn2 = () => {};
      dispatcher.on('event', fn1);
      dispatcher.on('event', fn2);

      const result = dispatcher.listeners('event');
      expect(result).toHaveLength(2);
      expect(result).toContain(fn1);
      expect(result).toContain(fn2);
    });

    it('listeners() returns empty for unregistered events', () => {
      expect(dispatcher.listeners('nope')).toEqual([]);
    });

    it('hasListeners() returns boolean', () => {
      expect(dispatcher.hasListeners('event')).toBe(false);
      dispatcher.on('event', () => {});
      expect(dispatcher.hasListeners('event')).toBe(true);
    });
  });

  describe('subscribe() — EventSubscriber', () => {
    it('registers multiple events from a subscriber', async () => {
      const events: string[] = [];

      const subscriber = {
        subscribe(d: IEventDispatcher) {
          d.on('user.created', () => events.push('created'));
          d.on('user.deleted', () => events.push('deleted'));
        },
      };

      dispatcher.subscribe(subscriber);

      await dispatcher.emit('user.created');
      await dispatcher.emit('user.deleted');

      expect(events).toEqual(['created', 'deleted']);
    });
  });

  describe('class-based events (Function token)', () => {
    class UserRegistered {
      constructor(public userId: number) {}
    }

    it('dispatches using class as event key', async () => {
      let received: unknown = null;
      dispatcher.on(UserRegistered, (payload) => { received = payload; });

      const event = new UserRegistered(42);
      await dispatcher.emit(UserRegistered, event);

      expect(received).toBe(event);
      expect((received as UserRegistered).userId).toBe(42);
    });
  });

  describe('clear()', () => {
    it('removes all listeners', () => {
      dispatcher.on('a', () => {});
      dispatcher.on('b', () => {});
      dispatcher.clear();

      expect(dispatcher.hasListeners('a')).toBe(false);
      expect(dispatcher.hasListeners('b')).toBe(false);
    });
  });
});

// ── EventFake ─────────────────────────────────────────────

describe('CARP-032: EventFake', () => {
  let fake: EventFake;

  beforeEach(() => {
    fake = EventFake.create();
  });

  describe('recording', () => {
    it('records emitted events', async () => {
      await fake.emit('user.registered', { id: 1 });
      await fake.emit('order.placed', { total: 99 });

      expect(fake.getDispatched()).toHaveLength(2);
    });

    it('does NOT call real listeners', async () => {
      let called = false;
      fake.on('event', () => { called = true; });

      await fake.emit('event');
      expect(called).toBe(false); // fake suppresses listener execution
    });
  });

  describe('assertDispatched()', () => {
    it('passes when event was dispatched', async () => {
      await fake.emit('user.registered', { id: 1 });
      fake.assertDispatched('user.registered');
    });

    it('fails when event was NOT dispatched', () => {
      expect(() => fake.assertDispatched('user.registered')).toThrow('not');
    });

    it('supports predicate on payload', async () => {
      await fake.emit('user.registered', { id: 1 });
      fake.assertDispatched('user.registered', (p) => (p as { id: number }).id === 1);
    });

    it('fails when predicate does not match', async () => {
      await fake.emit('user.registered', { id: 1 });
      expect(() =>
        fake.assertDispatched('user.registered', (p) => (p as { id: number }).id === 999),
      ).toThrow('predicate');
    });
  });

  describe('assertNotDispatched()', () => {
    it('passes when event was NOT dispatched', () => {
      fake.assertNotDispatched('some.event');
    });

    it('fails when event WAS dispatched', async () => {
      await fake.emit('some.event');
      expect(() => fake.assertNotDispatched('some.event')).toThrow('NOT');
    });
  });

  describe('assertDispatchedTimes()', () => {
    it('checks exact dispatch count', async () => {
      await fake.emit('event');
      await fake.emit('event');
      await fake.emit('event');

      fake.assertDispatchedTimes('event', 3);
    });

    it('fails on wrong count', async () => {
      await fake.emit('event');
      expect(() => fake.assertDispatchedTimes('event', 5)).toThrow('5');
    });
  });

  describe('assertNothingDispatched()', () => {
    it('passes when nothing dispatched', () => {
      fake.assertNothingDispatched();
    });

    it('fails when anything dispatched', async () => {
      await fake.emit('event');
      expect(() => fake.assertNothingDispatched()).toThrow('event');
    });
  });

  describe('reset()', () => {
    it('clears recorded events', async () => {
      await fake.emit('a');
      await fake.emit('b');
      fake.reset();
      fake.assertNothingDispatched();
    });
  });
});
