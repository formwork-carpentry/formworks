import { describe, expect, it } from 'vitest';

describe('Example: database-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/database-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
