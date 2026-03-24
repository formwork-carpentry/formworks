import { describe, expect, it } from 'vitest';

describe('Starter: saas-starter', () => {
  it('bootstraps with tenants', async () => {
    const { createApp } = await import('../../../starters/saas-starter/src/app.ts');
    const { kernel, config, tenantStore } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('SaaS Platform');
    expect((await tenantStore.all()).length).toBeGreaterThanOrEqual(2);
  });

  it('has acme and globex', async () => {
    const { createApp } = await import('../../../starters/saas-starter/src/app.ts');
    const { tenantStore } = await createApp();
    expect(await tenantStore.findBySlug('acme')).not.toBeNull();
    expect(await tenantStore.findBySlug('globex')).not.toBeNull();
  });
});
