import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ArrayChannel,
  ConsoleChannel,
  JsonChannel,
  NullChannel,
  StackChannel,
} from '../../src/log/channels.js';
import type { LogEntry } from '../../src/log/types.js';

function entry(level: LogEntry['level'], message = 'msg', context: Record<string, unknown> = {}): LogEntry {
  return {
    level,
    message,
    context,
    channel: 'test',
    timestamp: new Date('2024-01-01T00:00:00.000Z'),
  };
}

describe('log/channels', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    errorSpy.mockClear();
    warnSpy.mockClear();
    debugSpy.mockClear();
    logSpy.mockClear();
  });

  it('ConsoleChannel writes by severity and respects minLevel', () => {
    const channel = new ConsoleChannel('info');

    channel.write(entry('error', 'failed'));
    channel.write(entry('warning', 'warned'));
    channel.write(entry('debug', 'ignored-debug'));
    channel.write(entry('info', 'ok', { id: 1 }));

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(debugSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it('ArrayChannel stores and asserts entries', () => {
    const channel = new ArrayChannel('buffer', 'debug');
    channel.write(entry('info', 'saved', { requestId: 'r1' }));
    channel.write(entry('error', 'boom'));

    expect(channel.count()).toBe(2);
    expect(channel.forLevel('info')).toHaveLength(1);

    expect(() => channel.assertLogged('info', 'save')).not.toThrow();
    expect(() => channel.assertLoggedWithContext('info', 'requestId', 'r1')).not.toThrow();
    expect(() => channel.assertNotLogged('warning')).not.toThrow();
    expect(() => channel.assertCount(2)).not.toThrow();

    channel.reset();
    expect(() => channel.assertNothingLogged()).not.toThrow();
  });

  it('JsonChannel serializes entries and filters by minLevel', () => {
    const channel = new JsonChannel('warning');

    channel.write(entry('info', 'drop-me', { a: 1 }));
    channel.write(entry('error', 'keep-me', { requestId: 'r2' }));

    const output = channel.getOutput();
    expect(output).toHaveLength(1);

    const parsed = JSON.parse(output[0]) as Record<string, unknown>;
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('keep-me');
    expect(parsed.requestId).toBe('r2');

    channel.reset();
    expect(channel.getOutput()).toEqual([]);
  });

  it('NullChannel discards entries and StackChannel fans out', () => {
    const nullChannel = new NullChannel();
    expect(() => nullChannel.write(entry('info', 'ignored'))).not.toThrow();

    const left = new ArrayChannel('left');
    const right = new ArrayChannel('right');
    const stack = new StackChannel([left, right]);

    stack.write(entry('notice', 'fanout'));

    expect(left.count()).toBe(1);
    expect(right.count()).toBe(1);
    expect(stack.getChannels()).toHaveLength(2);
  });
});
