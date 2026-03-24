import { describe, expect, it } from 'vitest';

import * as log from '../../src/log/index.js';

describe('log/index', () => {
  it('re-exports logging and audit surface area', () => {
    expect(typeof log.Logger).toBe('function');
    expect(typeof log.LogManager).toBe('function');
    expect(typeof log.ArrayChannel).toBe('function');
    expect(typeof log.ConsoleChannel).toBe('function');
    expect(typeof log.AuditLogger).toBe('function');
    expect(typeof log.InMemoryAuditChannel).toBe('function');
    expect(typeof log.Log).toBe('object');
    expect(typeof log.Audit).toBe('object');
    expect(typeof log.setLogManager).toBe('function');
    expect(typeof log.setAuditLogger).toBe('function');
  });
});
