import { describe, it, expect } from 'vitest';
import { DevServer } from '../../../carpenter/cli/src/DevServer.js';

describe('devserver/DevServer', () => {
  it('creates with default config', () => {
    const server = new DevServer({ entry: 'src/server.ts' });
    const state = server.getState();
    expect(state.running).toBe(false);
    expect(state.restartCount).toBe(0);
    expect(state.pid).toBeNull();
  });

  it('accepts custom config', () => {
    const server = new DevServer({
      entry: 'src/app.ts',
      watch: ['src', 'config'],
      ignore: ['node_modules', 'dist', 'coverage'],
      extensions: ['.ts', '.tsx', '.json', '.yaml'],
      debounceMs: 500,
      runtime: 'bun',
      runtimeArgs: ['run'],
      env: { DATABASE_URL: 'sqlite::memory:' },
    });

    expect(server.getState().running).toBe(false);
  });

  it('stop() is safe before start()', () => {
    const server = new DevServer({ entry: 'src/server.ts' });
    server.stop();
    expect(server.getState().running).toBe(false);
  });

  it('accepts lifecycle callbacks', () => {
    const events: string[] = [];
    const server = new DevServer({
      entry: 'src/server.ts',
      onStart: () => events.push('start'),
      onRestart: (f) => events.push(`restart:${f}`),
      onError: (e) => events.push(`error:${e.message}`),
    });

    expect(server.getState().running).toBe(false);
    expect(events).toHaveLength(0);
  });
});
