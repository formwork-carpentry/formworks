/**
 * @module @carpentry/i18n
 * @description Localization and translation — {@link Translator}, {@link Pluralizer}, and loaders.
 *
 * Use this package to:
 * - Translate keys with `:` replacements (placeholders)
 * - Handle pluralization with `choice()` using plural rules
 * - Load translations into the `Translator` via {@link ObjectLoader} or {@link MemoryLoader}
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
 * translator.get('welcome', { name: 'Alice' });
 * translator.choice('posts.count', 3, { count: '3' });
 * ```
 *
 * @see Translator — Main translation API
 * @see ObjectLoader — Load from in-memory objects
 * @see Pluralizer — Plural rules for `choice()`
 */

export { Translator, setGlobalTranslator, __, trans, transChoice } from "./Translator.js";
export { Pluralizer } from "./pluralization/Pluralizer.js";
export { MemoryLoader, ObjectLoader } from "./loader/Loaders.js";
