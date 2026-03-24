import { describe, expect, it } from 'vitest';

describe('Example: blog-api', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/blog-api/src/app.ts');
    const { kernel, config } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('Blog API');
  });
});
