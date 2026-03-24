import { describe, it, expect } from 'vitest';
import { UnixSocketTransport, createUnixSocketServer } from '../../src/bridge/unix-socket.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unlinkSync } from 'node:fs';

describe('bridge/UnixSocketTransport', () => {
  const sockPath = join(tmpdir(), `carpenter-test-${process.pid}.sock`);

  it('sends and receives via unix socket', async () => {
    const server = createUnixSocketServer(sockPath, async (msg) => {
      if (msg.method === 'greet') {
        return { data: { message: `Hello, ${(msg.payload as Record<string, string>)['name']}` } };
      }
      return { error: { code: 'NOT_FOUND', message: 'Unknown method' } };
    });

    try {
      const transport = new UnixSocketTransport(sockPath);
      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      const response = await transport.send({
        id: 'req-1',
        service: 'greeter',
        method: 'greet',
        payload: { name: 'Alice' },
        timestamp: Date.now(),
      });

      expect(response.data).toEqual({ message: 'Hello, Alice' });

      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    } finally {
      server.close();
      try {
        unlinkSync(sockPath);
      } catch {
        // Ignore cleanup failures from already removed socket files.
      }
    }
  });
});
