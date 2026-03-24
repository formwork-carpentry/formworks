import { describe, expect, it } from 'vitest';

describe('Example: minimal-api', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/minimal-api/src/app.ts');
    const kernel = await createApp();
    expect(kernel).toBeDefined();
  });
});
