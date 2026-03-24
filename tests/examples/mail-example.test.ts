import { describe, expect, it } from 'vitest';

describe('Example: mail-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/mail-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
