import { describe, expect, it } from 'vitest';

describe('Example: ai-assistant', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/ai-assistant/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
