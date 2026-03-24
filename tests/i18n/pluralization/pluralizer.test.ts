import { describe, expect, it } from 'vitest';

import { Pluralizer } from '../../../src/i18n/pluralization/Pluralizer.js';

describe('i18n/pluralization/Pluralizer', () => {
  it('chooses exact and range segments first', () => {
    const p = new Pluralizer();

    const line = '{0} none|{1} one|[2,*] many';
    expect(p.choose(line, 0, 'en')).toBe('none');
    expect(p.choose(line, 1, 'en')).toBe('one');
    expect(p.choose(line, 9, 'en')).toBe('many');
  });

  it('uses language rules for simple plural forms', () => {
    const p = new Pluralizer();

    expect(p.choose('item|items', 1, 'en')).toBe('item');
    expect(p.choose('item|items', 2, 'en')).toBe('items');

    expect(p.choose('article|articles', 0, 'fr')).toBe('article');
    expect(p.choose('article|articles', 2, 'fr')).toBe('articles');

    expect(p.choose('same|other', 5, 'ja')).toBe('same');
  });

  it('handles multi-form locales and falls back to last segment', () => {
    const p = new Pluralizer();

    const ru = 'one|few|many';
    expect(p.choose(ru, 1, 'ru')).toBe('one');
    expect(p.choose(ru, 2, 'ru')).toBe('few');
    expect(p.choose(ru, 5, 'ru')).toBe('many');

    const ar = 'zero|one|two|few|many|other';
    expect(p.choose(ar, 0, 'ar')).toBe('zero');
    expect(p.choose(ar, 11, 'ar')).toBe('many');

    // Unknown locale uses default 2-form rule and falls back safely
    expect(p.choose('only', 3, 'xx')).toBe('only');
  });
});
