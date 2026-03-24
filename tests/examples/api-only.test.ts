import { describe, expect, it } from 'vitest';

describe('Example: api-only', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/api-only/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
