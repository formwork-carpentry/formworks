import { describe, expect, it } from 'vitest';

describe('Example: blog-app', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/blog-app/src/app.ts');
    const { kernel, config } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('Carpenter Blog');
  });
});
