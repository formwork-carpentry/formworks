import { describe, expect, it } from 'vitest';

import { CarpenterFactoryBase } from '../../src/adapters/index.js';

describe('adapters/index', () => {
  it('re-exports adapter base abstractions', () => {
    expect(typeof CarpenterFactoryBase).toBe('function');
  });
});
