import { describe, expect, it } from 'vitest';

import { ArrayChannel } from '../../src/log/channels.js';
import { LogManager } from '../../src/log/LogManager.js';

describe('LogManager', () => {
  it('registers channels and resolves channel logger', () => {
    // Arrange
    const manager = new LogManager('console');
    const channel = new ArrayChannel('test');
    manager.addChannel(channel);

    // Act
    const logger = manager.channel('test');
    logger.info('hello', { scope: 'unit' });

    // Assert
    const entries = channel.all();
    expect(entries.length).toBe(1);
    expect(entries[0]?.level).toBe('info');
    expect(entries[0]?.message).toBe('hello');
  });

  it('creates fake channel for default logger usage', () => {
    // Arrange
    const manager = new LogManager('audit');

    // Act
    const fake = manager.fake('audit');
    manager.error('boom', { id: 1 });

    // Assert
    expect(fake.all().length).toBe(1);
    expect(fake.all()[0]?.level).toBe('error');
  });
});
