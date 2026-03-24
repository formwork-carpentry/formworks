/**
 * @module @carpentry/i18n
 * @description Translator — resolve translation keys with replacements, pluralization, fallback locale
 * @patterns Strategy (loaders, pluralizer), Flyweight (caches loaded translations)
 * @principles SRP — translates strings only; DIP — depends on ITranslationLoader interface
 */

import type {
  ITranslator,
  ITranslationLoader,
  IPluralizer,
} from '../contracts';
import type { Dictionary } from '../core/types';

/**
 * Translator resolves translation keys into localized strings.
 *
 * The translator loads namespaces using an {@link ITranslationLoader} and applies plural
 * rules via an {@link IPluralizer}.
 *
 * Keys are dot-notation where the first segment is the namespace (e.g. `posts.count`).
 *
 * @example
 * ```ts
 * import { Translator, ObjectLoader, Pluralizer } from './';
 *
 * const translator = new Translator(
 *   new ObjectLoader({
 *     en: { welcome: 'Hello, :name!' },
 *     posts: { count: '{0} No posts|{1} One post|[2,*] :count posts' },
 *   }),
 *   new Pluralizer(),
 *   'en',
 * );
 *
 * await translator.loadAll('en');
 *
 * translator.get('welcome', { name: 'Alice' }); // Hello, Alice!
 * translator.choice('posts.count', 3, { count: '3' }); // '3 posts'
 * ```
 *
 * @see ObjectLoader — In-memory loader
 * @see Pluralizer — Plural rules for `choice()`
 */
export class Translator implements ITranslator {
  private locale: string;
  private fallbackLocale: string;
  private loader: ITranslationLoader;
  private pluralizer: IPluralizer;

  /** Cache: locale → namespace → key → value */
  private loaded = new Map<string, Map<string, Dictionary<string>>>();

  constructor(
    loader: ITranslationLoader,
    pluralizer: IPluralizer,
    locale: string = 'en',
    fallbackLocale: string = 'en',
  ) {
    this.loader = loader;
    this.pluralizer = pluralizer;
    this.locale = locale;
    this.fallbackLocale = fallbackLocale;
  }

  // ── ITranslator ─────────────────────────────────────────

  /**
   * @param {string} key
   * @param {Dictionary<string | number>} [replacements]
   * @param {string} [locale]
   * @returns {string}
   */
  get(key: string, replacements?: Dictionary<string | number>, locale?: string): string {
    const resolvedLocale = locale ?? this.locale;
    const line = this.resolve(key, resolvedLocale);

    if (line === null) {
      // Fallback locale
      if (resolvedLocale !== this.fallbackLocale) {
        const fallbackLine = this.resolve(key, this.fallbackLocale);
        if (fallbackLine !== null) {
          return this.applyReplacements(fallbackLine, replacements);
        }
      }
      // Return the key itself as last resort (standard Laravel behaviour)
      return key;
    }

    return this.applyReplacements(line, replacements);
  }

  /**
   * @param {string} key
   * @param {number} count
   * @param {Dictionary<string | number>} [replacements]
   * @param {string} [locale]
   * @returns {string}
   */
  choice(key: string, count: number, replacements?: Dictionary<string | number>, locale?: string): string {
    const resolvedLocale = locale ?? this.locale;
    let line = this.resolve(key, resolvedLocale);

    if (line === null && resolvedLocale !== this.fallbackLocale) {
      line = this.resolve(key, this.fallbackLocale);
    }

    if (line === null) return key;

    // Apply pluralization
    const chosen = this.pluralizer.choose(line, count, resolvedLocale);

    // Merge :count into replacements
    const merged = { count: String(count), ...replacements };
    return this.applyReplacements(chosen, merged);
  }

  getLocale(): string {
    return this.locale;
  }

  /**
   * @param {string} locale
   */
  setLocale(locale: string): void {
    this.locale = locale;
  }

  getFallbackLocale(): string {
    return this.fallbackLocale;
  }

  /**
   * @param {string} locale
   */
  setFallbackLocale(locale: string): void {
    this.fallbackLocale = locale;
  }

  /**
   * @param {string} key
   * @param {string} [locale]
   * @returns {boolean}
   */
  has(key: string, locale?: string): boolean {
    const resolvedLocale = locale ?? this.locale;
    return this.resolve(key, resolvedLocale) !== null;
  }

  /**
   * @param {string} locale
   * @param {string} [namespace]
   * @returns {Dictionary<string>}
   */
  getTranslations(locale: string, namespace?: string): Dictionary<string> {
    const localeMap = this.loaded.get(locale);
    if (!localeMap) return {};
    if (namespace) return localeMap.get(namespace) ?? {};

    const merged: Dictionary<string> = {};
    for (const [ns, translations] of localeMap) {
      for (const [k, v] of Object.entries(translations)) {
        merged[`${ns}.${k}`] = v;
      }
    }
    return merged;
  }

  /**
   * @param {string} locale
   * @param {string} namespace
   * @param {Dictionary<string>} translations
   */
  addTranslations(locale: string, namespace: string, translations: Dictionary<string>): void {
    if (!this.loaded.has(locale)) {
      this.loaded.set(locale, new Map());
    }
    const localeMap = this.loaded.get(locale)!;
    const existing = localeMap.get(namespace) ?? {};
    localeMap.set(namespace, { ...existing, ...translations });
  }

  // ── Internal Resolution ─────────────────────────────────

  /**
   * Resolve a dot-notation key: "namespace.key.nested"
   * First segment is the namespace (file), rest is the nested key path.
   */
  private resolve(key: string, locale: string): string | null {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) return null;

    const namespace = key.substring(0, dotIndex);
    const path = key.substring(dotIndex + 1);

    // Ensure namespace is loaded
    this.ensureLoaded(locale, namespace);

    const localeMap = this.loaded.get(locale);
    if (!localeMap) return null;

    const translations = localeMap.get(namespace);
    if (!translations) return null;

    // Support nested keys: "welcome.greeting" within namespace
    return this.dotGet(translations, path);
  }

  /**
   * Synchronous load — in production, translations are pre-loaded at boot.
   * For sync resolution we check the cache only. loadAsync() pre-warms.
   */
  private ensureLoaded(locale: string, namespace: string): void {
    const localeMap = this.loaded.get(locale);
    if (localeMap?.has(namespace)) return;
    // Translations not loaded — they should have been pre-loaded via loadNamespace()
    // In sync mode, we can't load. The key will return null and fallback.
  }

  /** Pre-load a namespace (called during boot) */
  /**
   * @param {string} locale
   * @param {string} namespace
   * @returns {Promise<void>}
   */
  async loadNamespace(locale: string, namespace: string): Promise<void> {
    if (!this.loaded.has(locale)) {
      this.loaded.set(locale, new Map());
    }
    const translations = await this.loader.load(locale, namespace);
    this.loaded.get(locale)!.set(namespace, translations);
  }

  /** Pre-load all namespaces for a locale */
  /**
   * @param {string} locale
   * @returns {Promise<void>}
   */
  async loadAll(locale: string): Promise<void> {
    const namespaces = await this.loader.namespaces(locale);
    for (const ns of namespaces) {
      await this.loadNamespace(locale, ns);
    }
  }

  // ── Helpers ─────────────────────────────────────────────

  private applyReplacements(line: string, replacements?: Dictionary<string | number>): string {
    if (!replacements) return line;

    let result = line;
    for (const [key, value] of Object.entries(replacements)) {
      // Replace :key (Laravel style) and {key} (ICU style)
      result = result.replace(new RegExp(`:${key}`, 'g'), String(value));
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return result;
  }

  private dotGet(obj: Dictionary<string>, path: string): string | null {
    // For flat translation files, try direct key first
    if (path in obj) return obj[path];

    // For nested: "welcome.title" → obj.welcome.title
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return null;
      }
      current = (current as Dictionary)[part];
    }
    return typeof current === 'string' ? current : null;
  }
}

// ── Global Helper Functions ───────────────────────────────

let globalTranslator: ITranslator | null = null;

/** Set the global translator instance (called during Application boot) */
/**
 * @param {ITranslator} translator
 */
export function setGlobalTranslator(translator: ITranslator): void {
  globalTranslator = translator;
}

/**
 * Translate a key — Laravel-style `__()` helper.
 *
 * @example
 * ```typescript
 * __('messages.welcome', { name: 'Alice' })  // "Hello, Alice!"
 * ```
 */
export function __(key: string, replacements?: Dictionary<string | number>, locale?: string): string {
  if (!globalTranslator) return key;
  return globalTranslator.get(key, replacements, locale);
}

/**
 * Translate a key — `trans()` alias for `__()`.
 */
export const trans = __;

/**
 * Translate with pluralization.
 *
 * @example
 * ```typescript
 * transChoice('cart.items', 3)  // "3 items"
 * transChoice('cart.items', 1)  // "1 item"
 * ```
 */
export function transChoice(
  key: string,
  count: number,
  replacements?: Dictionary<string | number>,
  locale?: string,
): string {
  if (!globalTranslator) return key;
  return globalTranslator.choice(key, count, replacements, locale);
}
