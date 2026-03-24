import { describe, expect, it } from 'vitest';

import * as providers from '../../../src/foundation/providers/index.js';

describe('foundation/providers index', () => {
  it('exports all infrastructure providers', () => {
    // Assert
    expect(providers.CoreInfrastructureProvider).toBeDefined();
    expect(providers.DatabaseInfrastructureProvider).toBeDefined();
    expect(providers.CacheInfrastructureProvider).toBeDefined();
    expect(providers.QueueInfrastructureProvider).toBeDefined();
    expect(providers.MailInfrastructureProvider).toBeDefined();
    expect(providers.StorageInfrastructureProvider).toBeDefined();
    expect(providers.BridgeInfrastructureProvider).toBeDefined();
  });
});
