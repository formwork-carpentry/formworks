import { describe, expect, it } from 'vitest';

describe('Example: storage-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/storage-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
