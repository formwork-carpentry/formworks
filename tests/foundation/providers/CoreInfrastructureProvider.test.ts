import { describe, expect, it } from 'vitest';

import { CoreInfrastructureProvider } from '../../../src/foundation/providers/CoreInfrastructureProvider.js';
import { createProviderTestContext } from './support.js';

describe('CoreInfrastructureProvider', () => {
  it('registers logger, events, and validator singletons', () => {
    // Arrange
    const { container, resolver } = createProviderTestContext();
    const provider = new CoreInfrastructureProvider(container, resolver);

    // Act
    provider.register();

    // Assert
    expect(container.bound('logger')).toBe(true);
    expect(container.bound('events')).toBe(true);
    expect(container.bound('validator')).toBe(true);
  });
});
