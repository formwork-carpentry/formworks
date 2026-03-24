import { describe, expect, it } from 'vitest';

import * as tooling from '../../src/tooling/index.js';
import * as corePlugin from '../../src/core/plugin.js';

describe('tooling/index', () => {
  it('exports plugin tooling as first-class namespace', () => {
    expect(typeof tooling.PluginManager).toBe('function');
    expect(typeof tooling.CompletionProvider).toBe('function');
    expect(Array.isArray(tooling.KNOWN_BINDINGS)).toBe(true);
    expect(Array.isArray(tooling.KNOWN_CONFIG_PATHS)).toBe(true);
  });

  it('keeps core/plugin compatibility exports', () => {
    expect(typeof corePlugin.PluginManager).toBe('function');
    expect(typeof corePlugin.CompletionProvider).toBe('function');
  });
});
