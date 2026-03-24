import { describe, expect, it } from 'vitest';

describe('Starter: blog-starter', () => {
  it('bootstraps with i18n', async () => {
    const { createApp } = await import('../../../starters/blog-starter/src/app.ts');
    const { kernel, config, translator } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('Carpenter Blog');
    expect(translator.get('nav.home')).toBe('Home');
  });

  it('switches locale to French', async () => {
    const { createApp } = await import('../../../starters/blog-starter/src/app.ts');
    const { translator } = await createApp();
    translator.setLocale('fr');
    expect(translator.get('nav.home')).toBe('Accueil');
    translator.setLocale('en');
  });
});
