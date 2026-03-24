/**
 * @module @carpentry/i18n
 * @description Translation loaders — Memory (testing), Object (inline config)
 * @patterns Adapter (implements ITranslationLoader), Strategy (swappable loaders)
 * @principles LSP — all loaders substitutable; SRP — loading translations only
 */

import type { ITranslationLoader } from '../../contracts';
import type { Dictionary } from '../../core/types';

/**
 * In-memory translation loader — for testing.
 *
 * @example
 * ```typescript
 * const loader = new MemoryLoader();
 * loader.addTranslations('en', 'messages', { welcome: 'Hello, :name!' });
 * loader.addTranslations('fr', 'messages', { welcome: 'Bonjour, :name!' });
 * ```
 */
export class MemoryLoader implements ITranslationLoader {
  /** locale → namespace → translations */
  private store = new Map<string, Map<string, Dictionary<string>>>();

  /**
   * @param {string} locale
   * @param {string} namespace
   * @param {Dictionary<string>} translations
   */
  addTranslations(locale: string, namespace: string, translations: Dictionary<string>): void {
    if (!this.store.has(locale)) {
      this.store.set(locale, new Map());
    }
    this.store.get(locale)!.set(namespace, translations);
  }

  /**
   * @param {string} locale
   * @param {string} namespace
   * @returns {Promise<Dictionary<string>>}
   */
  async load(locale: string, namespace: string): Promise<Dictionary<string>> {
    return this.store.get(locale)?.get(namespace) ?? {};
  }

  /**
   * @param {string} locale
   * @returns {Promise<string[]>}
   */
  async namespaces(locale: string): Promise<string[]> {
    const localeMap = this.store.get(locale);
    return localeMap ? Array.from(localeMap.keys()) : [];
  }

  async locales(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

/**
 * Object-based loader — pass a translations object directly.
 * Useful for small apps that define translations inline in config.
 *
 * @example
 * ```typescript
 * const loader = new ObjectLoader({
 *   en: {
 *     messages: { welcome: 'Hello!', goodbye: 'Bye!' },
 *     auth: { failed: 'Invalid credentials.' },
 *   },
 *   fr: {
 *     messages: { welcome: 'Bonjour!', goodbye: 'Au revoir!' },
 *   },
 * });
 * ```
 */
export class ObjectLoader implements ITranslationLoader {
  constructor(
    private translations: Record<string, Record<string, Dictionary<string>>>,
  ) {}

  /**
   * @param {string} locale
   * @param {string} namespace
   * @returns {Promise<Dictionary<string>>}
   */
  async load(locale: string, namespace: string): Promise<Dictionary<string>> {
    return this.translations[locale]?.[namespace] ?? {};
  }

  /**
   * @param {string} locale
   * @returns {Promise<string[]>}
   */
  async namespaces(locale: string): Promise<string[]> {
    const localeData = this.translations[locale];
    return localeData ? Object.keys(localeData) : [];
  }

  async locales(): Promise<string[]> {
    return Object.keys(this.translations);
  }
}
