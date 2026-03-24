import { describe, expect, it } from 'vitest';

import { MailInfrastructureProvider } from '../../../src/foundation/providers/MailInfrastructureProvider.js';
import { createProviderTestContext } from './support.js';

describe('MailInfrastructureProvider', () => {
  it('registers mail manager and mail binding', () => {
    // Arrange
    const { container, resolver } = createProviderTestContext();
    const provider = new MailInfrastructureProvider(container, resolver);

    // Act
    provider.register();

    // Assert
    expect(container.bound('mail.manager')).toBe(true);
    expect(container.bound('mail')).toBe(true);
    expect(container.make('mail.manager')).toBeDefined();
  });
});
