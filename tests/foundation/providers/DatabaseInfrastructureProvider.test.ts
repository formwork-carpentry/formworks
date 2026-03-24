import { describe, expect, it } from 'vitest';

import { DatabaseInfrastructureProvider } from '../../../src/foundation/providers/DatabaseInfrastructureProvider.js';
import { createProviderTestContext } from './support.js';

describe('DatabaseInfrastructureProvider', () => {
  it('registers database manager and default db binding', () => {
    // Arrange
    const { container, resolver } = createProviderTestContext();
    const provider = new DatabaseInfrastructureProvider(container, resolver);

    // Act
    provider.register();

    // Assert
    expect(container.bound('db.manager')).toBe(true);
    expect(container.bound('db')).toBe(true);
    expect(container.make('db.manager')).toBeDefined();
  });
});
