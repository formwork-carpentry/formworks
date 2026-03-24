import { describe, expect, it } from 'vitest';

import * as tooling from '../../src/tooling/index.js';

describe('tooling/index', () => {
  it('exports plugin tooling as first-class namespace', () => {
    expect(typeof tooling.PluginManager).toBe('function');
    expect(typeof tooling.CompletionProvider).toBe('function');
    expect(Array.isArray(tooling.KNOWN_BINDINGS)).toBe(true);
    expect(Array.isArray(tooling.KNOWN_CONFIG_PATHS)).toBe(true);
  });
});
