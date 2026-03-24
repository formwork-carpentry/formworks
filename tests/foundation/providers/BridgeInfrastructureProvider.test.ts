import { describe, expect, it } from 'vitest';

import { BridgeInfrastructureProvider } from '../../../src/foundation/providers/BridgeInfrastructureProvider.js';
import { createProviderTestContext } from './support.js';

describe('BridgeInfrastructureProvider', () => {
  it('registers bridge manager and bridge binding', () => {
    // Arrange
    const { container, resolver } = createProviderTestContext();
    const provider = new BridgeInfrastructureProvider(container, resolver);

    // Act
    provider.register();

    // Assert
    expect(container.bound('bridge.manager')).toBe(true);
    expect(container.bound('bridge')).toBe(true);
    expect(container.make('bridge.manager')).toBeDefined();
  });
});
