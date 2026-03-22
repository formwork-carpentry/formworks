/**
 * @module @formwork/core/contracts/i18n
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
export {};
//# sourceMappingURL=index.js.map