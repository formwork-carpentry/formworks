import { describe, expect, it } from 'vitest';

import { QueueInfrastructureProvider } from '../../../src/foundation/providers/QueueInfrastructureProvider.js';
import { createProviderTestContext } from './support.js';

describe('QueueInfrastructureProvider', () => {
  it('registers queue manager and queue binding', () => {
    // Arrange
    const { container, resolver } = createProviderTestContext();
    const provider = new QueueInfrastructureProvider(container, resolver);

    // Act
    provider.register();

    // Assert
    expect(container.bound('queue.manager')).toBe(true);
    expect(container.bound('queue')).toBe(true);
    expect(container.make('queue.manager')).toBeDefined();
  });
});
