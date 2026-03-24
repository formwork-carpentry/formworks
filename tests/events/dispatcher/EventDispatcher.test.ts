import { describe, expect, it, vi } from 'vitest';

import { EventDispatcher, EventFake } from '../../../src/events/dispatcher/EventDispatcher.js';

describe('EventDispatcher', () => {
  class UserRegistered {
    constructor(public readonly userId: number) {}
  }

  it('dispatches class-based events to listeners', async () => {
    const events = new EventDispatcher();
    const listener = vi.fn(async (_event?: UserRegistered) => {});

    events.on(UserRegistered, listener);
    await events.dispatch(UserRegistered, new UserRegistered(42));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toBeInstanceOf(UserRegistered);
    expect((listener.mock.calls[0]?.[0] as UserRegistered).userId).toBe(42);
  });

  it('supports wildcard string listeners', async () => {
    const events = new EventDispatcher();
    const listener = vi.fn(async () => {});

    events.on('user.*', listener);
    await events.dispatch('user.created', { id: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('invokes once listener only once', async () => {
    const events = new EventDispatcher();
    const listener = vi.fn(async () => {});

    events.once('orders.placed', listener);
    await events.dispatch('orders.placed', { id: 1 });
    await events.dispatch('orders.placed', { id: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps emit as a compatibility alias', async () => {
    const events = new EventDispatcher();
    const listener = vi.fn(async () => {});

    events.on('legacy.event', listener);
    const legacyEmit = (events as unknown as {
      emit?: (name: string, payload?: unknown) => Promise<void>;
    })['emit'];
    expect(typeof legacyEmit).toBe('function');
    await legacyEmit?.call(events, 'legacy.event', { ok: true });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('EventFake', () => {
  it('records dispatched events for assertions', async () => {
    const fake = EventFake.create();

    await fake.dispatch('user.registered', { id: 7 });

    expect(() => fake.assertDispatched('user.registered')).not.toThrow();
    expect(() => fake.assertDispatchedTimes('user.registered', 1)).not.toThrow();
  });
});
