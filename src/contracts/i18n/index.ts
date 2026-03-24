/**
 * @module @carpentry/core/contracts/i18n
 * @description Internationalization contracts - translation and pluralization.
 *
 * Implementations: Translator, ObjectLoader, MemoryLoader, Pluralizer
 *
 * @example
 * ```ts
 * const t = container.make<ITranslator>('translator');
 * t.get('welcome.greeting', { name: 'Alice' }); // "Hello, Alice!"
 * t.choice('posts.count', 5, { count: '5' });   // "5 posts"
 * ```
 */

import type { Dictionary } from "@carpentry/formworks/core/types";

/** @typedef {Record<string, string | number>} I18nDictionary - String key to value map */
export type I18nDictionary<V = string> = Record<string, V>;

/** @typedef {Object} ITranslator - Translation engine contract */
export interface ITranslator {
  /**
   * Get a translated string by key.
   * @param {string} key - Translation key in 'namespace.key' format (e.g., 'nav.home')
   * @param {I18nDictionary<string | number>} [replacements] - Placeholder values
   * @param {string} [locale] - Override locale (defaults to current)
   * @returns {string} Translated string, or the key itself if not found
   * @example
   * ```ts
   * t.get('auth.welcome', { name: 'Alice' }); // "Welcome back, Alice!"
   * t.get('nav.home');                          // "Home"
   * t.get('nav.home', {}, 'fr');               // "Accueil"
   * ```
   */
  get(key: string, replacements?: I18nDictionary<string | number>, locale?: string): string;

  /**
   * Get a pluralized translation.
   * @param {string} key - Translation key containing plural forms
   * @param {number} count - Count for pluralization
   * @param {I18nDictionary<string | number>} [replacements] - Placeholder values
   * @param {string} [locale] - Override locale
   * @returns {string} Pluralized string
   * @example
   * ```ts
   * // Given: 'posts.count': '{0} No posts|{1} One post|[2,*] :count posts'
   * t.choice('posts.count', 0);                // "No posts"
   * t.choice('posts.count', 1);                // "One post"
   * t.choice('posts.count', 42, { count: '42' }); // "42 posts"
   * ```
   */
  choice(
    key: string,
    count: number,
    replacements?: I18nDictionary<string | number>,
    locale?: string,
  ): string;

  /**
   * Get the current locale.
   * @returns {string} Current locale code (e.g., 'en', 'fr')
   */
  getLocale(): string;

  /**
   * Set the current locale.
   * @param {string} locale - Locale code
   * @returns {void}
   */
  setLocale(locale: string): void;
}

/** @typedef {Object} ITranslationLoader - Loads translation data from a source */
export interface ITranslationLoader {
  /**
   * Load translations for a locale and namespace.
   * @param {string} locale - Locale code (e.g., 'en')
   * @param {string} namespace - Translation namespace (e.g., 'messages', 'validation')
   * @returns {Promise<Dictionary<string>>} Key-value translation pairs
   */
  load(locale: string, namespace: string): Promise<Dictionary<string>>;

  /**
   * List all available namespaces for a locale.
   * @param {string} locale - Locale code
   * @returns {Promise<string[]>} Namespace names
   */
  namespaces(locale: string): Promise<string[]>;

  /**
   * List all available locales.
   * @returns {Promise<string[]>} Locale codes
   */
  locales(): Promise<string[]>;
}

/** @typedef {Object} IPluralizer - Pluralization engine contract */
export interface IPluralizer {
  /**
   * Choose the correct plural form from a pipe-separated string.
   * @param {string} line - Plural forms (e.g., '{0} None|{1} One|[2,*] :count items')
   * @param {number} count - The count to pluralize for
   * @param {string} locale - Locale code
   * @returns {string} Selected plural form
   */
  choose(line: string, count: number, locale: string): string;
}
