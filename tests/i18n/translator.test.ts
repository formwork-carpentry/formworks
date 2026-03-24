import { describe, expect, it } from 'vitest';

import { MemoryLoader } from '../../src/i18n/loader/Loaders.js';
import { Pluralizer } from '../../src/i18n/pluralization/Pluralizer.js';
import { __, trans, transChoice, setGlobalTranslator, Translator } from '../../src/i18n/Translator.js';

describe('i18n/Translator', () => {
  it('resolves translations with replacements and fallback locale', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'messages', {
      welcome: 'Hello, :name!',
      nested: '{who} says hi',
    });

    const translator = new Translator(loader, new Pluralizer(), 'fr', 'en');
    await translator.loadNamespace('en', 'messages');

    expect(translator.get('messages.welcome', { name: 'Alice' })).toBe('Hello, Alice!');
    expect(translator.get('messages.nested', { who: 'Bob' })).toBe('Bob says hi');
    expect(translator.get('messages.missing')).toBe('messages.missing');
  });

  it('supports choice(), locale switching, and translation cache APIs', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'posts', {
      count: '{0} No posts|{1} One post|[2,*] :count posts',
    });
    loader.addTranslations('fr', 'posts', {
      count: '{0} Aucun|{1} Un|[2,*] :count articles',
    });

    const translator = new Translator(loader, new Pluralizer(), 'en', 'en');
    await translator.loadAll('en');
    await translator.loadAll('fr');

    expect(translator.choice('posts.count', 0)).toBe('No posts');
    expect(translator.choice('posts.count', 1)).toBe('One post');
    expect(translator.choice('posts.count', 3)).toBe('3 posts');

    translator.setLocale('fr');
    expect(translator.getLocale()).toBe('fr');
    expect(translator.choice('posts.count', 4)).toBe('4 articles');

    translator.setFallbackLocale('en');
    expect(translator.getFallbackLocale()).toBe('en');

    translator.addTranslations('fr', 'messages', { hi: 'Salut' });
    expect(translator.has('messages.hi', 'fr')).toBe(true);
    expect(translator.getTranslations('fr', 'messages')).toEqual({ hi: 'Salut' });
    expect(translator.getTranslations('fr')['posts.count']).toBeDefined();
  });

  it('global helper functions delegate to configured translator', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'messages', {
      welcome: 'Hello, :name!',
    });
    loader.addTranslations('en', 'items', {
      count: '{0} none|{1} one|[2,*] :count many',
    });

    const translator = new Translator(loader, new Pluralizer(), 'en', 'en');
    await translator.loadAll('en');
    setGlobalTranslator(translator);

    expect(__('messages.welcome', { name: 'Tess' })).toBe('Hello, Tess!');
    expect(trans('messages.welcome', { name: 'Sam' })).toBe('Hello, Sam!');
    expect(transChoice('items.count', 2)).toBe('2 many');
  });
});
