import { describe, expect, it } from 'vitest';

describe('Example: fullstack-react', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/fullstack-react/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
