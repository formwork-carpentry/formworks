import { describe, expect, it } from 'vitest';

describe('Starter: fullstack-starter', () => {
  it('bootstraps with i18n and router', async () => {
    const { createApp } = await import('../../../starters/fullstack-starter/src/app.ts');
    const { kernel, translator } = await createApp({ skipEnv: true });
    expect(kernel).toBeDefined();
    expect(translator.get('nav.home')).toBe('Home');
  });

  it('switches locale to French', async () => {
    const { createApp } = await import('../../../starters/fullstack-starter/src/app.ts');
    const { translator } = await createApp({ skipEnv: true });
    translator.setLocale('fr');
    expect(translator.get('nav.home')).toBe('Accueil');
    translator.setLocale('en');
  });
});
