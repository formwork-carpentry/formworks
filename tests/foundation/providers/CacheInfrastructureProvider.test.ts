import { describe, expect, it } from 'vitest';

import { CacheInfrastructureProvider } from '../../../src/foundation/providers/CacheInfrastructureProvider.js';
import { createProviderTestContext } from './support.js';

describe('CacheInfrastructureProvider', () => {
  it('registers cache manager and cache binding', () => {
    // Arrange
    const { container, resolver } = createProviderTestContext();
    const provider = new CacheInfrastructureProvider(container, resolver);

    // Act
    provider.register();

    // Assert
    expect(container.bound('cache.manager')).toBe(true);
    expect(container.bound('cache')).toBe(true);
    expect(container.make('cache.manager')).toBeDefined();
  });
});
