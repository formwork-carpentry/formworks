import { describe, expect, it } from 'vitest';

describe('Example: queue-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/queue-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
