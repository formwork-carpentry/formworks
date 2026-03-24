import { describe, expect, it } from 'vitest';

import { StorageInfrastructureProvider } from '../../../src/foundation/providers/StorageInfrastructureProvider.js';
import { createProviderTestContext } from './support.js';

describe('StorageInfrastructureProvider', () => {
  it('registers storage manager and storage binding', () => {
    // Arrange
    const { container, resolver } = createProviderTestContext();
    const provider = new StorageInfrastructureProvider(container, resolver);

    // Act
    provider.register();

    // Assert
    expect(container.bound('storage.manager')).toBe(true);
    expect(container.bound('storage')).toBe(true);
    expect(container.make('storage.manager')).toBeDefined();
  });
});
