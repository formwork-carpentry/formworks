import { describe, it, expect } from 'vitest';

describe('Starter: api-starter', () => {
  it('bootstraps with config and router', async () => {
    const { createApp } = await import('../../starters/api-starter/src/app.ts');
    const { kernel, config, router } = await createApp();
    expect(kernel).toBeDefined();
    expect(router).toBeDefined();
    expect(config.get('app.name')).toBe('API Starter');
  });
});

describe('Starter: blog-starter', () => {
  it('bootstraps with i18n', async () => {
    const { createApp } = await import('../../starters/blog-starter/src/app.ts');
    const { kernel, config, translator } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('Carpenter Blog');
    expect(translator.get('nav.home')).toBe('Home');
  });

  it('switches locale to French', async () => {
    const { createApp } = await import('../../starters/blog-starter/src/app.ts');
    const { translator } = await createApp();
    translator.setLocale('fr');
    expect(translator.get('nav.home')).toBe('Accueil');
    translator.setLocale('en');
  });
});

describe('Starter: saas-starter', () => {
  it('bootstraps with tenants', async () => {
    const { createApp } = await import('../../starters/saas-starter/src/app.ts');
    const { kernel, config, tenantStore } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('SaaS Platform');
    expect((await tenantStore.all()).length).toBeGreaterThanOrEqual(2);
  });

  it('has acme and globex', async () => {
    const { createApp } = await import('../../starters/saas-starter/src/app.ts');
    const { tenantStore } = await createApp();
    expect(await tenantStore.findBySlug('acme')).not.toBeNull();
    expect(await tenantStore.findBySlug('globex')).not.toBeNull();
  });
});

describe('Starter: fullstack-starter', () => {
  it('bootstraps with i18n and router', async () => {
    const { createApp } = await import('../../starters/fullstack-starter/src/app.ts');
    const { kernel, config, translator } = await createApp({ skipEnv: true });
    expect(kernel).toBeDefined();
    expect(translator.get('nav.home')).toBe('Home');
  });

  it('switches locale to French', async () => {
    const { createApp } = await import('../../starters/fullstack-starter/src/app.ts');
    const { translator } = await createApp({ skipEnv: true });
    translator.setLocale('fr');
    expect(translator.get('nav.home')).toBe('Accueil');
    translator.setLocale('en');
  });
});
