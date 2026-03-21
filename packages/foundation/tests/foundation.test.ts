/**
 * @module @formwork/foundation
 * @description Tests for InfrastructureServiceProvider and bootstrap()
 */

import { describe, it, expect } from 'vitest';
import { Container } from '@formwork/core/container';
import { Config } from '@formwork/core/config';
import { buildDefaultConfig } from '@formwork/core/config';
import { ConfigResolver } from '@formwork/core/config';
import { InfrastructureServiceProvider } from '../src/InfrastructureServiceProvider.js';
import { bootstrap } from '../src/Bootstrap.js';

describe('InfrastructureServiceProvider', () => {
  function createContainerWithConfig(overrides: Record<string, unknown> = {}): Container {
    const container = new Container();
    const config = new Config(buildDefaultConfig());
    if (Object.keys(overrides).length > 0) config.merge(overrides);
    container.instance('config', config);
    return container;
  }

  it('registers all infrastructure bindings', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();
    provider.boot();

    // All key bindings should exist
    expect(container.make('config')).toBeInstanceOf(Config);
    expect(container.make('config.resolver')).toBeInstanceOf(ConfigResolver);
    expect(container.make('events')).toBeTruthy();
    expect(container.make('validator')).toBeTruthy();
    expect(container.make('logger')).toBeTruthy();
  });

  it('resolves default database connection', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const db = container.make('db');
    expect(db).toBeTruthy();
    expect((db as { driverName(): string }).driverName()).toBe('sqlite-memory');
  });

  it('resolves database manager', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const manager = container.make('db.manager');
    expect(manager).toBeTruthy();
  });

  it('resolves default cache store', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const cache = container.make('cache');
    expect(cache).toBeTruthy();
  });

  it('resolves default queue connection', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const queue = container.make('queue');
    expect(queue).toBeTruthy();
  });

  it('resolves default mail adapter', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const mailer = container.make('mail');
    expect(mailer).toBeTruthy();
  });

  it('resolves default storage disk', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const storage = container.make('storage');
    expect(storage).toBeTruthy();
  });

  it('uses config overrides', () => {
    const container = createContainerWithConfig({ cache: { default: 'null' } });
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const resolver = container.make('config.resolver') as ConfigResolver;
    expect(resolver.cacheDriver()).toBe('null');
  });

  it('singletons return same instance', () => {
    const container = createContainerWithConfig();
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const db1 = container.make('db');
    const db2 = container.make('db');
    expect(db1).toBe(db2);

    const events1 = container.make('events');
    const events2 = container.make('events');
    expect(events1).toBe(events2);
  });

  it('builds default config when none provided', () => {
    const container = new Container(); // no config instance
    const provider = new InfrastructureServiceProvider(container);
    provider.register();

    const config = container.make('config') as Config;
    expect(config.get('app.name')).toBeTruthy();
    expect(config.get('database.default')).toBeTruthy();
  });
});

describe('bootstrap()', () => {
  it('returns container and config', async () => {
    const { container, config } = await bootstrap({ skipEnv: true });

    expect(container).toBeInstanceOf(Container);
    expect(config).toBeInstanceOf(Config);
  });

  it('wires all infrastructure', async () => {
    const { container } = await bootstrap({ skipEnv: true });

    expect(container.make('db')).toBeTruthy();
    expect(container.make('cache')).toBeTruthy();
    expect(container.make('queue')).toBeTruthy();
    expect(container.make('mail')).toBeTruthy();
    expect(container.make('events')).toBeTruthy();
    expect(container.make('validator')).toBeTruthy();
    expect(container.make('logger')).toBeTruthy();
  });

  it('applies config overrides', async () => {
    const { config } = await bootstrap({
      skipEnv: true,
      configOverrides: { app: { name: 'TestApp' } },
    });

    expect(config.get('app.name')).toBe('TestApp');
  });

  it('registers additional providers', async () => {
    let booted = false;

    class TestProvider {
      constructor(private app: { singleton(key: string, factory: () => unknown): void }) {}
      register() { this.app.singleton('test.service', () => ({ ok: true })); }
      boot() { booted = true; }
    }

    const { container } = await bootstrap({
      skipEnv: true,
      providers: [TestProvider as unknown as new (app: unknown) => { register(): void; boot(): void }],
    });

    expect(container.make('test.service')).toEqual({ ok: true });
    expect(booted).toBe(true);
  });

  it('accepts custom config', async () => {
    const { config } = await bootstrap({
      skipEnv: true,
      config: { app: { name: 'Custom' }, database: { default: 'memory', connections: { memory: { driver: 'memory' } } } },
    });

    expect(config.get('app.name')).toBe('Custom');
  });
});
