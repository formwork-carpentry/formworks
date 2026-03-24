import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from '@carpentry/formworks/tooling';
import { Container } from '@carpentry/core/container';

describe('tooling/PluginManager lifecycle', () => {
  let manager: PluginManager;
  let container: Container;

  beforeEach(() => {
    manager = new PluginManager();
    container = new Container();
  });

  it('boots plugins and supports async boot', async () => {
    const booted: string[] = [];
    manager.add({ name: 'a', version: '1.0.0', register: () => {}, boot: () => booted.push('a') });
    manager.add({
      name: 'b',
      version: '1.0.0',
      register: () => {},
      boot: async () => {
        await new Promise((r) => setTimeout(r, 5));
        booted.push('b');
      },
    });

    manager.registerAll(container);
    await manager.bootAll(container);
    expect(booted).toEqual(['a', 'b']);
  });

  it('shuts down in reverse order', async () => {
    const order: string[] = [];
    manager.add({ name: 'a', version: '1.0.0', register: () => {}, boot: () => {}, shutdown: () => order.push('a') });
    manager.add({ name: 'b', version: '1.0.0', register: () => {}, boot: () => {}, shutdown: () => order.push('b') });

    manager.registerAll(container);
    await manager.bootAll(container);
    await manager.shutdownAll();
    expect(order).toEqual(['b', 'a']);
  });
});
