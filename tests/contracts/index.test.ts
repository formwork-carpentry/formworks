import { describe, expect, it } from 'vitest';

import * as contracts from '../../src/contracts/index.js';

describe('contracts/index', () => {
  it('exposes first-class contracts surface', () => {
    // Runtime checks for representative contract exports.
    expect(typeof contracts.METADATA_KEYS).toBe('object');
  });
});
