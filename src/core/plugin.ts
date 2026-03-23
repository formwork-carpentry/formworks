/**
 * @module @carpentry/core/plugin
 * @description TypeScript plugin system — IDE support, completions, and plugin manager.
 *
 * @example
 * ```ts
 * import { PluginManager, CompletionProvider } from './plugin';
 *
 * const pm = new PluginManager();
 * const completions = CompletionProvider.completions('container.m', lineText, position);
 * ```
 */

export { PluginManager } from "./plugin/PluginManager.js";
export type { CarpenterPlugin, PluginState } from "./plugin/PluginManager.js";
export { CompletionProvider, KNOWN_BINDINGS, KNOWN_CONFIG_PATHS } from "./plugin/TsPlugin.js";
export type { CompletionItem } from "./plugin/TsPlugin.js";
