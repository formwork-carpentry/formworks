/**
 * @module @carpentry/core/plugin
 * @description Compatibility shim for tooling and IDE integration exports.
 *
 * @example
 * ```ts
 * import { PluginManager, CompletionProvider } from '@carpentry/formworks/tooling';
 *
 * const pm = new PluginManager();
 * const completions = CompletionProvider.completions('container.m', lineText, position);
 * ```
 */

export { PluginManager } from "../tooling/PluginManager.js";
export type { CarpenterPlugin, PluginState } from "../tooling/PluginManager.js";
export { CompletionProvider, KNOWN_BINDINGS, KNOWN_CONFIG_PATHS } from "../tooling/TsPlugin.js";
export type { CompletionItem } from "../tooling/TsPlugin.js";
