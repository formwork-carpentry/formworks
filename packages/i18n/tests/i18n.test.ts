/**
 * @module @formwork/i18n
 * @description Tests for i18n system — translation, pluralization, loaders, helpers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Translator, setGlobalTranslator, __, trans, transChoice } from '../src/Translator.js';
import { Pluralizer } from '../src/pluralization/Pluralizer.js';
import { MemoryLoader, ObjectLoader } from '../src/loader/Loaders.js';

// ── Fixtures ──────────────────────────────────────────────

function createLoader(): MemoryLoader {
  const loader = new MemoryLoader();

  loader.addTranslations('en', 'messages', {
    welcome: 'Welcome, :name!',
    goodbye: 'Goodbye!',
    'nested.deep.key': 'Deep value',
  });

  loader.addTranslations('en', 'auth', {
    failed: 'These credentials do not match our records.',
    throttle: 'Too many attempts. Try again in :seconds seconds.',
  });

  loader.addTranslations('en', 'cart', {
    items: '{0} No items|{1} :count item|[2,*] :count items',
    simple: 'item|items',
  });

  loader.addTranslations('fr', 'messages', {
    welcome: 'Bienvenue, :name!',
    goodbye: 'Au revoir!',
  });

  loader.addTranslations('fr', 'cart', {
    items: '{0} Aucun article|{1} :count article|[2,*] :count articles',
  });

  loader.addTranslations('ja', 'messages', {
    welcome: 'ようこそ、:name!',
  });

  return loader;
}

async function createTranslator(locale: string = 'en'): Promise<Translator> {
  const loader = createLoader();
  const pluralizer = new Pluralizer();
  const translator = new Translator(loader, pluralizer, locale, 'en');
  await translator.loadAll('en');
  await translator.loadAll('fr');
  await translator.loadAll('ja');
  return translator;
}

// ── Tests ─────────────────────────────────────────────────

describe('Translator', () => {
  let t: Translator;

  beforeEach(async () => {
    t = await createTranslator();
  });

  describe('basic translation', () => {
    it('resolves a simple key', () => {
      expect(t.get('messages.goodbye')).toBe('Goodbye!');
    });

    it('resolves a key with replacements', () => {
      expect(t.get('messages.welcome', { name: 'Alice' })).toBe('Welcome, Alice!');
    });

    it('resolves nested dot-notation keys', () => {
      expect(t.get('messages.nested.deep.key')).toBe('Deep value');
    });

    it('returns the key itself when not found', () => {
      expect(t.get('messages.nonexistent')).toBe('messages.nonexistent');
    });

    it('returns the key for completely unknown namespace', () => {
      expect(t.get('unknown.key')).toBe('unknown.key');
    });
  });

  describe('locale switching', () => {
    it('getLocale() returns current locale', () => {
      expect(t.getLocale()).toBe('en');
    });

    it('setLocale() switches the active locale', () => {
      t.setLocale('fr');
      expect(t.get('messages.welcome', { name: 'Alice' })).toBe('Bienvenue, Alice!');
    });

    it('explicit locale parameter overrides current locale', () => {
      expect(t.get('messages.welcome', { name: 'Alice' }, 'fr')).toBe('Bienvenue, Alice!');
    });

    it('Japanese translations work', () => {
      expect(t.get('messages.welcome', { name: 'Alice' }, 'ja')).toBe('ようこそ、Alice!');
    });
  });

  describe('fallback locale', () => {
    it('falls back to fallback locale when key missing in current locale', () => {
      t.setLocale('fr');
      // 'auth.failed' doesn't exist in French — falls back to English
      expect(t.get('auth.failed')).toBe('These credentials do not match our records.');
    });

    it('getFallbackLocale() returns fallback', () => {
      expect(t.getFallbackLocale()).toBe('en');
    });

    it('setFallbackLocale() changes fallback', () => {
      t.setFallbackLocale('fr');
      expect(t.getFallbackLocale()).toBe('fr');
    });
  });

  describe('has()', () => {
    it('returns true for existing keys', () => {
      expect(t.has('messages.welcome')).toBe(true);
      expect(t.has('auth.failed')).toBe(true);
    });

    it('returns false for missing keys', () => {
      expect(t.has('messages.nonexistent')).toBe(false);
    });

    it('checks specific locale', () => {
      expect(t.has('auth.failed', 'en')).toBe(true);
      expect(t.has('auth.failed', 'fr')).toBe(false);
    });
  });

  describe('replacements', () => {
    it(':key style replacement', () => {
      expect(t.get('auth.throttle', { seconds: 30 })).toBe(
        'Too many attempts. Try again in 30 seconds.',
      );
    });

    it('multiple replacements', () => {
      t.addTranslations('en', 'test', { multi: ':a and :b and :c' });
      expect(t.get('test.multi', { a: 'X', b: 'Y', c: 'Z' })).toBe('X and Y and Z');
    });

    it('{key} ICU-style replacement', () => {
      t.addTranslations('en', 'test', { icu: 'Hello {name}, you are {age}!' });
      expect(t.get('test.icu', { name: 'Bob', age: 25 })).toBe('Hello Bob, you are 25!');
    });
  });

  describe('addTranslations() at runtime', () => {
    it('adds translations for existing locale/namespace', () => {
      t.addTranslations('en', 'messages', { newkey: 'New Value' });
      expect(t.get('messages.newkey')).toBe('New Value');
      // Existing keys still work
      expect(t.get('messages.goodbye')).toBe('Goodbye!');
    });

    it('adds translations for new locale/namespace', () => {
      t.addTranslations('de', 'messages', { hello: 'Hallo!' });
      expect(t.get('messages.hello', undefined, 'de')).toBe('Hallo!');
    });
  });

  describe('getTranslations()', () => {
    it('returns all translations for a locale + namespace', () => {
      const auth = t.getTranslations('en', 'auth');
      expect(auth['failed']).toBe('These credentials do not match our records.');
    });

    it('returns empty for unknown locale', () => {
      expect(t.getTranslations('zz', 'messages')).toEqual({});
    });
  });
});

describe('Pluralizer', () => {
  const p = new Pluralizer();

  describe('simple 2-form pluralization', () => {
    it('singular', () => {
      expect(p.choose('item|items', 1, 'en')).toBe('item');
    });

    it('plural', () => {
      expect(p.choose('item|items', 0, 'en')).toBe('items');
      expect(p.choose('item|items', 2, 'en')).toBe('items');
      expect(p.choose('item|items', 100, 'en')).toBe('items');
    });
  });

  describe('range-based syntax', () => {
    const line = '{0} No items|{1} :count item|[2,*] :count items';

    it('{0} matches zero', () => {
      expect(p.choose(line, 0, 'en')).toBe('No items');
    });

    it('{1} matches one', () => {
      expect(p.choose(line, 1, 'en')).toBe(':count item');
    });

    it('[2,*] matches 2+', () => {
      expect(p.choose(line, 5, 'en')).toBe(':count items');
      expect(p.choose(line, 100, 'en')).toBe(':count items');
    });
  });

  describe('French pluralization (0 and 1 are singular)', () => {
    it('0 is singular in French', () => {
      expect(p.choose('article|articles', 0, 'fr')).toBe('article');
    });

    it('1 is singular in French', () => {
      expect(p.choose('article|articles', 1, 'fr')).toBe('article');
    });

    it('2+ is plural in French', () => {
      expect(p.choose('article|articles', 2, 'fr')).toBe('articles');
    });
  });

  describe('East Asian — no plural forms', () => {
    it('always returns first form', () => {
      expect(p.choose('item|items', 0, 'ja')).toBe('item');
      expect(p.choose('item|items', 1, 'ja')).toBe('item');
      expect(p.choose('item|items', 100, 'ja')).toBe('item');
    });
  });
});

describe('transChoice() integration', () => {
  let t: Translator;

  beforeEach(async () => {
    t = await createTranslator();
  });

  it('pluralizes with count replacement', () => {
    expect(t.choice('cart.items', 0)).toBe('No items');
    expect(t.choice('cart.items', 1)).toBe('1 item');
    expect(t.choice('cart.items', 5)).toBe('5 items');
  });

  it('pluralizes in French', () => {
    expect(t.choice('cart.items', 0, undefined, 'fr')).toBe('Aucun article');
    expect(t.choice('cart.items', 1, undefined, 'fr')).toBe('1 article');
    expect(t.choice('cart.items', 10, undefined, 'fr')).toBe('10 articles');
  });
});

describe('MemoryLoader', () => {
  it('loads translations', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'auth', { failed: 'Bad creds' });

    expect(await loader.load('en', 'auth')).toEqual({ failed: 'Bad creds' });
  });

  it('returns empty for missing locale', async () => {
    const loader = new MemoryLoader();
    expect(await loader.load('zz', 'auth')).toEqual({});
  });

  it('lists locales', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'auth', {});
    loader.addTranslations('fr', 'auth', {});
    expect(await loader.locales()).toEqual(['en', 'fr']);
  });

  it('lists namespaces', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'auth', {});
    loader.addTranslations('en', 'messages', {});
    expect(await loader.namespaces('en')).toEqual(['auth', 'messages']);
  });
});

describe('ObjectLoader', () => {
  it('loads from inline config', async () => {
    const loader = new ObjectLoader({
      en: {
        messages: { hi: 'Hello' },
      },
    });
    expect(await loader.load('en', 'messages')).toEqual({ hi: 'Hello' });
    expect(await loader.locales()).toEqual(['en']);
    expect(await loader.namespaces('en')).toEqual(['messages']);
  });
});

describe('Global helper functions', () => {
  let t: Translator;

  beforeEach(async () => {
    t = await createTranslator();
    setGlobalTranslator(t);
  });

  afterEach(() => {
    setGlobalTranslator(null as unknown as Translator);
  });

  it('__() translates', () => {
    expect(__('messages.welcome', { name: 'Test' })).toBe('Welcome, Test!');
  });

  it('trans() is an alias for __()', () => {
    expect(trans('messages.goodbye')).toBe('Goodbye!');
  });

  it('transChoice() pluralizes', () => {
    expect(transChoice('cart.items', 3)).toBe('3 items');
  });

  it('__() returns key when no translator set', () => {
    setGlobalTranslator(null as unknown as Translator);
    expect(__('some.key')).toBe('some.key');
  });
});
