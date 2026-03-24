import { describe, expect, it } from 'vitest';

describe('Starter: api-starter', () => {
  it('bootstraps with config and router', async () => {
    const { createApp } = await import('../../../starters/api-starter/src/app.ts');
    const { kernel, config, router } = await createApp();
    expect(kernel).toBeDefined();
    expect(router).toBeDefined();
    expect(config.get('app.name')).toBe('API Starter');
  });
});
