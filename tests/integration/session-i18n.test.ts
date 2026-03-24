import { describe, it, expect } from 'vitest';
import { Session, MemorySessionStore } from '../../src/session/index.js';
import { Translator } from '../../src/i18n/Translator.js';
import { Pluralizer } from '../../src/i18n/pluralization/Pluralizer.js';
import { MemoryLoader } from '../../src/i18n/loader/Loaders.js';

describe('integration/session-i18n', () => {
  it('handles session flash lifecycle and csrf token round-trip', async () => {
    const store = new MemorySessionStore('sess-1');
    const session = new Session(store);
    await session.start();

    await session.flash('errors', { email: ['Invalid email'] });
    await session.flashInput({ name: 'Alice', email: 'bad' });
    await session.save();

    const nextSession = new Session(store);
    await nextSession.start();
    expect(await nextSession.get('errors')).toEqual({ email: ['Invalid email'] });
    expect(await nextSession.old('name')).toBe('Alice');
    expect(await nextSession.old('email')).toBe('bad');

    const token = await nextSession.token();
    expect(await nextSession.verifyToken(token)).toBe(true);
    expect(await nextSession.verifyToken('forged-token')).toBe(false);
    await nextSession.save();

    const thirdSession = new Session(store);
    await thirdSession.start();
    expect(await thirdSession.get('errors')).toBeNull();
    expect(await thirdSession.hasOldInput('name')).toBe(false);
    expect(await thirdSession.verifyToken(token)).toBe(true);
  });

  it('translates and pluralizes across locales', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'cart', {
      items: '{0} No items|{1} :count item|[2,*] :count items',
    });
    loader.addTranslations('fr', 'cart', {
      items: '{0} Aucun article|{1} :count article|[2,*] :count articles',
    });

    const translator = new Translator(loader, new Pluralizer(), 'en', 'en');
    await translator.loadAll('en');
    await translator.loadAll('fr');

    expect(translator.choice('cart.items', 0)).toBe('No items');
    expect(translator.choice('cart.items', 1)).toBe('1 item');
    expect(translator.choice('cart.items', 42)).toBe('42 items');
    expect(translator.choice('cart.items', 0, undefined, 'fr')).toBe('Aucun article');
    expect(translator.choice('cart.items', 5, undefined, 'fr')).toBe('5 articles');
  });
});
