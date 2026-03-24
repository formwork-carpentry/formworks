import { describe, expect, it } from 'vitest';

import { MemoryLoader, ObjectLoader } from '../../../src/i18n/loader/Loaders.js';

describe('i18n/loader/Loaders', () => {
  it('MemoryLoader stores and retrieves locale namespaces', async () => {
    const loader = new MemoryLoader();

    loader.addTranslations('en', 'messages', { hello: 'Hello' });
    loader.addTranslations('fr', 'messages', { hello: 'Bonjour' });

    expect(await loader.load('en', 'messages')).toEqual({ hello: 'Hello' });
    expect(await loader.load('en', 'missing')).toEqual({});
    expect(await loader.namespaces('en')).toEqual(['messages']);
    expect(await loader.locales()).toEqual(['en', 'fr']);
  });

  it('ObjectLoader reads static translation objects', async () => {
    const loader = new ObjectLoader({
      en: {
        auth: { failed: 'Invalid credentials.' },
        messages: { hi: 'Hi' },
      },
      de: {
        messages: { hi: 'Hallo' },
      },
    });

    expect(await loader.load('en', 'auth')).toEqual({ failed: 'Invalid credentials.' });
    expect(await loader.load('en', 'unknown')).toEqual({});
    expect(await loader.namespaces('en')).toEqual(['auth', 'messages']);
    expect(await loader.namespaces('missing')).toEqual([]);
    expect(await loader.locales()).toEqual(['en', 'de']);
  });
});
