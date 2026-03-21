/**
 * @module tests/examples
 * @description Smoke tests for media-example.
 */

import { describe, it, expect } from 'vitest';

describe('Example: media-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/media-example/src/app.js');
    const { kernel, config } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('Carpenter Media Demo');
  });
});
