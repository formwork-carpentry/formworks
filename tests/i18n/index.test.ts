import { describe, expect, it } from 'vitest';

import * as i18n from '../../src/i18n/index.js';

describe('i18n/index', () => {
  it('re-exports translator, pluralizer, loaders, and helpers', () => {
    expect(typeof i18n.Translator).toBe('function');
    expect(typeof i18n.Pluralizer).toBe('function');
    expect(typeof i18n.MemoryLoader).toBe('function');
    expect(typeof i18n.ObjectLoader).toBe('function');
    expect(typeof i18n.setGlobalTranslator).toBe('function');
    expect(typeof i18n.__).toBe('function');
    expect(typeof i18n.trans).toBe('function');
    expect(typeof i18n.transChoice).toBe('function');
  });
});
