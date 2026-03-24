import { describe, expect, it } from 'vitest';

import { EventDispatcher, EventFake } from '../../src/events/index.js';

describe('events/index', () => {
  it('re-exports EventDispatcher and EventFake', () => {
    expect(typeof EventDispatcher).toBe('function');
    expect(typeof EventFake).toBe('function');
  });
});
