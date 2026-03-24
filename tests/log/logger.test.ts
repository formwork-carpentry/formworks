import { describe, expect, it } from 'vitest';

import { ArrayChannel } from '../../src/log/channels.js';
import { Logger } from '../../src/log/Logger.js';

describe('log/Logger', () => {
  it('writes entries with channel name and merged context', () => {
    const channel = new ArrayChannel('test');
    const logger = new Logger(channel, { app: 'formworks', env: 'test' });

    logger.info('started', { requestId: 'r1' });

    const [entry] = channel.all();
    expect(entry?.level).toBe('info');
    expect(entry?.message).toBe('started');
    expect(entry?.channel).toBe('test');
    expect(entry?.context).toEqual({ app: 'formworks', env: 'test', requestId: 'r1' });
  });

  it('creates child logger with additional default context', () => {
    const channel = new ArrayChannel('test');
    const parent = new Logger(channel, { app: 'formworks' });
    const child = parent.withContext({ tenant: 'acme' });

    child.error('failed', { code: 500 });

    const [entry] = channel.all();
    expect(entry?.level).toBe('error');
    expect(entry?.context).toEqual({ app: 'formworks', tenant: 'acme', code: 500 });
    expect(child.getChannel()).toBe(channel);
  });
});
