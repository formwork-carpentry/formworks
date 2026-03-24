import { describe, expect, it } from 'vitest';

describe('Example: saas-starter', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/saas/src/app.ts');
    const { kernel, config } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('SaaS Starter');
  });
});
