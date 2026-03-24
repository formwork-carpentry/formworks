/**
 * @module @carpentry/tooling
 * @description Tooling and IDE integration entrypoint.
 */

export { PluginManager } from './PluginManager.js';
export type { CarpenterPlugin, PluginState } from './PluginManager.js';
export { CompletionProvider, KNOWN_BINDINGS, KNOWN_CONFIG_PATHS } from './TsPlugin.js';
export type { CompletionItem } from './TsPlugin.js';
