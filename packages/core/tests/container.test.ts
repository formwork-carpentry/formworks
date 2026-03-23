/**
 * @module @carpentry/core
 * @description Complete test suite for IoC Container — CARP-003 through CARP-006
 *
 * CARP-003: Core bindings & resolution (bind, singleton, instance, make, auto-wiring, circular)
 * CARP-004: Decorators (@Injectable, @Singleton, @Inject)
 * CARP-005: Scoped bindings & child containers
 * CARP-006: Service providers (register/boot lifecycle)
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from '../src/container/Container.js';
import { Injectable, Singleton, Inject } from '../src/container/decorators.js';
import { ServiceProvider, METADATA_KEYS } from '../src/contracts/container/index.js';
import type { IContainer } from '../src/contracts/container/index.js';
import {
  BindingNotFoundError,
  CircularDependencyError,
  ContainerError,
} from '../src/exceptions/index.js';

// ─── Test Fixtures ──────────────────────────────────────────

class SimpleService {
  value = 'simple';
}

class AnotherService {
  value = 'another';
}

class DisposableService {
  disposed = false;
  dispose() {
    this.disposed = true;
  }
}

// ─────────────────────────────────────────────────────────────
// CARP-003: IoC Container — Core Bindings & Resolution
// ─────────────────────────────────────────────────────────────

describe('CARP-003: Container — Core Bindings & Resolution', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('bind() — transient bindings', () => {
    it('creates a new instance on every make() call', () => {
      container.bind('service', () => new SimpleService());

      const a = container.make<SimpleService>('service');
      const b = container.make<SimpleService>('service');

      expect(a).toBeInstanceOf(SimpleService);
      expect(b).toBeInstanceOf(SimpleService);
      expect(a).not.toBe(b); // different instances
    });

    it('passes the container to the factory function', () => {
      container.instance('config-value', 42);
      container.bind('service', (c) => {
        const val = c.make<number>('config-value');
        const svc = new SimpleService();
        svc.value = `configured-${val}`;
        return svc;
      });

      const result = container.make<SimpleService>('service');
      expect(result.value).toBe('configured-42');
    });
  });

  describe('singleton() — single instance bindings', () => {
    it('returns the same instance on every make() call', () => {
      container.singleton('service', () => new SimpleService());

      const a = container.make<SimpleService>('service');
      const b = container.make<SimpleService>('service');

      expect(a).toBe(b); // exact same reference
    });

    it('only invokes the factory once', () => {
      let callCount = 0;
      container.singleton('service', () => {
        callCount++;
        return new SimpleService();
      });

      container.make('service');
      container.make('service');
      container.make('service');

      expect(callCount).toBe(1);
    });
  });

  describe('instance() — pre-built value bindings', () => {
    it('returns the exact value provided', () => {
      const existing = new SimpleService();
      existing.value = 'pre-built';
      container.instance('service', existing);

      const resolved = container.make<SimpleService>('service');
      expect(resolved).toBe(existing);
      expect(resolved.value).toBe('pre-built');
    });

    it('works with primitive values', () => {
      container.instance('port', 3000);
      container.instance('name', 'Carpenter');
      container.instance('debug', true);

      expect(container.make<number>('port')).toBe(3000);
      expect(container.make<string>('name')).toBe('Carpenter');
      expect(container.make<boolean>('debug')).toBe(true);
    });
  });

  describe('bound() — checks binding existence', () => {
    it('returns true for registered bindings', () => {
      container.bind('a', () => 1);
      container.singleton('b', () => 2);
      container.instance('c', 3);

      expect(container.bound('a')).toBe(true);
      expect(container.bound('b')).toBe(true);
      expect(container.bound('c')).toBe(true);
    });

    it('returns false for unregistered tokens', () => {
      expect(container.bound('nonexistent')).toBe(false);
    });
  });

  describe('alias() — token aliasing', () => {
    it('resolves aliases to the original binding', () => {
      container.singleton('real-service', () => new SimpleService());
      container.alias('real-service', 'alias-service');

      const real = container.make<SimpleService>('real-service');
      const aliased = container.make<SimpleService>('alias-service');

      expect(aliased).toBe(real);
    });

    it('supports chained aliases', () => {
      container.instance('original', 'hello');
      container.alias('original', 'level1');
      container.alias('level1', 'level2');

      expect(container.make<string>('level2')).toBe('hello');
    });

    it('detects circular aliases', () => {
      container.alias('a', 'b');
      container.alias('b', 'a');

      expect(() => container.make('a')).toThrow(ContainerError);
    });
  });

  describe('Symbol tokens', () => {
    it('supports Symbol as binding token', () => {
      const TOKEN = Symbol('MyService');
      container.singleton(TOKEN, () => new SimpleService());

      const result = container.make<SimpleService>(TOKEN);
      expect(result).toBeInstanceOf(SimpleService);
    });
  });

  describe('make() — error handling', () => {
    it('throws BindingNotFoundError for unregistered tokens', () => {
      expect(() => container.make('nonexistent')).toThrow(BindingNotFoundError);
    });

    it('throws CircularDependencyError on circular factory deps', () => {
      container.bind('a', (c) => c.make('b'));
      container.bind('b', (c) => c.make('a'));

      expect(() => container.make('a')).toThrow(CircularDependencyError);
    });
  });

  describe('tag() and tagged() — grouped bindings', () => {
    it('resolves all tagged bindings', () => {
      container.bind('svc1', () => new SimpleService());
      container.bind('svc2', () => new AnotherService());
      container.tag('services', ['svc1', 'svc2']);

      const all = container.tagged<SimpleService | AnotherService>('services');
      expect(all).toHaveLength(2);
    });

    it('returns empty array for unknown tags', () => {
      expect(container.tagged('nonexistent')).toEqual([]);
    });
  });

  describe('resolving() — lifecycle callbacks', () => {
    it('fires callback when a token is resolved', () => {
      let fired = false;
      let receivedInstance: unknown = null;

      container.bind('service', () => new SimpleService());
      container.resolving('service', (instance) => {
        fired = true;
        receivedInstance = instance;
      });

      const result = container.make<SimpleService>('service');

      expect(fired).toBe(true);
      expect(receivedInstance).toBe(result);
    });
  });

  describe('flush() — clears all bindings', () => {
    it('empties the container completely', () => {
      container.bind('a', () => 1);
      container.singleton('b', () => 2);
      container.instance('c', 3);

      container.flush();

      expect(container.bound('a')).toBe(false);
      expect(container.bound('b')).toBe(false);
      expect(container.bound('c')).toBe(false);
    });
  });

  describe('makeWith() — parameterized resolution', () => {
    it('overrides bindings for a single resolution', () => {
      container.bind('greeter', (c) => {
        const name = c.make<string>('name');
        return `Hello, ${name}!`;
      });

      const result = container.makeWith<string>('greeter', { name: 'Carpenter' });
      expect(result).toBe('Hello, Carpenter!');
    });
  });

  describe('container self-binding', () => {
    it('can bind and resolve itself', () => {
      container.instance('container', container);
      const resolved = container.make<Container>('container');
      expect(resolved).toBe(container);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// CARP-004: IoC Container — Decorators
// ─────────────────────────────────────────────────────────────

describe('CARP-004: Container — Decorators', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('@Injectable()', () => {
    it('marks class as resolvable via metadata', () => {
      @Injectable()
      class MyService {}

      const isInjectable = Reflect.getMetadata(METADATA_KEYS.INJECTABLE, MyService);
      expect(isInjectable).toBe(true);
    });

    it('allows auto-wiring a zero-dependency class', () => {
      @Injectable()
      class MyService {
        value = 'autowired';
      }

      const result = container.make<MyService>(MyService);
      expect(result).toBeInstanceOf(MyService);
      expect(result.value).toBe('autowired');
    });

    it('throws if class is NOT decorated with @Injectable', () => {
      class NotInjectable {}

      expect(() => container.make(NotInjectable)).toThrow(ContainerError);
      expect(() => container.make(NotInjectable)).toThrow('not marked as @Injectable');
    });
  });

  describe('@Singleton()', () => {
    it('returns same instance on repeated make() calls', () => {
      @Singleton()
      class GlobalConfig {
        id = Math.random();
      }

      const a = container.make<GlobalConfig>(GlobalConfig);
      const b = container.make<GlobalConfig>(GlobalConfig);

      expect(a).toBe(b);
      expect(a.id).toBe(b.id);
    });

    it('also sets @Injectable metadata', () => {
      @Singleton()
      class MySingleton {}

      expect(Reflect.getMetadata(METADATA_KEYS.INJECTABLE, MySingleton)).toBe(true);
      expect(Reflect.getMetadata(METADATA_KEYS.SINGLETON, MySingleton)).toBe(true);
    });
  });

  describe('@Inject()', () => {
    it('overrides auto-wired parameter token', () => {
      @Injectable()
      class Logger {
        log(msg: string) { return msg; }
      }

      @Injectable()
      class UserService {
        constructor(
          @Inject('logger') public readonly logger: Logger,
        ) {}
      }

      const logger = new Logger();
      container.instance('logger', logger);

      const svc = container.make<UserService>(UserService);
      expect(svc.logger).toBe(logger);
    });

    it('works with Symbol tokens', () => {
      const LOGGER = Symbol('Logger');

      @Injectable()
      class Logger {
        name = 'symbol-logger';
      }

      @Injectable()
      class App {
        constructor(@Inject(LOGGER) public readonly logger: Logger) {}
      }

      container.instance(LOGGER, new Logger());
      const app = container.make<App>(App);
      expect(app.logger.name).toBe('symbol-logger');
    });
  });

  describe('auto-wiring with nested dependencies', () => {
    it('recursively resolves constructor dependencies', () => {
      @Injectable()
      class Database {
        query() { return 'data'; }
      }

      @Injectable()
      class UserRepository {
        constructor(public readonly db: Database) {}
      }

      @Injectable()
      class UserService {
        constructor(public readonly repo: UserRepository) {}
      }

      const svc = container.make<UserService>(UserService);
      expect(svc).toBeInstanceOf(UserService);
      expect(svc.repo).toBeInstanceOf(UserRepository);
      expect(svc.repo.db).toBeInstanceOf(Database);
      expect(svc.repo.db.query()).toBe('data');
    });

    it('detects circular auto-wired dependencies', () => {
      @Injectable()
      class A {
        constructor(@Inject('B') public b: unknown) {}
      }

      @Injectable()
      class B {
        constructor(@Inject('A') public a: unknown) {}
      }

      container.bind('A', (c) => c.make(A));
      container.bind('B', (c) => c.make(B));

      // Direct class auto-wiring circular
      container.singleton('Ax', (c) => new A(c.make('Bx')));
      container.singleton('Bx', (c) => new B(c.make('Ax')));

      expect(() => container.make('Ax')).toThrow(CircularDependencyError);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// CARP-005: IoC Container — Scoped Bindings & Child Containers
// ─────────────────────────────────────────────────────────────

describe('CARP-005: Container — Scoped Bindings & Child Containers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('scope() — child container creation', () => {
    it('creates a child container', () => {
      const child = container.scope();
      expect(child).toBeDefined();
      expect(child).not.toBe(container);
    });

    it('child inherits parent bindings', () => {
      container.singleton('service', () => new SimpleService());

      const child = container.scope();
      const fromChild = child.make<SimpleService>('service');
      const fromParent = container.make<SimpleService>('service');

      expect(fromChild).toBe(fromParent); // same singleton
    });

    it('child can override parent bindings', () => {
      container.instance('config', 'parent-value');

      const child = container.scope();
      child.instance('config', 'child-value');

      expect(container.make<string>('config')).toBe('parent-value');
      expect(child.make<string>('config')).toBe('child-value');
    });

    it('parent cannot access child bindings', () => {
      const child = container.scope();
      child.instance('child-only', 'secret');

      expect(() => container.make('child-only')).toThrow(BindingNotFoundError);
    });
  });

  describe('scoped singletons — isolated per scope', () => {
    it('different scopes get different instances', () => {
      container.singleton('service', () => new SimpleService());

      // Singletons in the parent are shared across scopes
      const scope1 = container.scope();
      const scope2 = container.scope();

      const fromScope1 = scope1.make<SimpleService>('service');
      const fromScope2 = scope2.make<SimpleService>('service');

      // Parent singletons are shared
      expect(fromScope1).toBe(fromScope2);

      // But scope-local bindings are isolated
      scope1.singleton('local', () => ({ id: Math.random() }));
      scope2.singleton('local', () => ({ id: Math.random() }));

      const local1a = scope1.make<{ id: number }>('local');
      const local1b = scope1.make<{ id: number }>('local');
      const local2 = scope2.make<{ id: number }>('local');

      expect(local1a).toBe(local1b); // same within scope
      expect(local1a).not.toBe(local2); // different across scopes
    });
  });

  describe('destroy() — scope cleanup', () => {
    it('disposes IDisposable instances in the scope', async () => {
      const child = container.scope() as Container;
      child.singleton('disposable', () => new DisposableService());

      const svc = child.make<DisposableService>('disposable');
      expect(svc.disposed).toBe(false);

      await child.destroy();
      expect(svc.disposed).toBe(true);
    });

    it('clears instance cache on destroy', async () => {
      const child = container.scope() as Container;
      child.singleton('svc', () => new SimpleService());

      const before = child.make<SimpleService>('svc');
      await child.destroy();

      // Re-register and resolve — should be a new instance
      child.singleton('svc', () => new SimpleService());
      const after = child.make<SimpleService>('svc');

      expect(before).not.toBe(after);
    });
  });

  describe('nested scopes', () => {
    it('grandchild resolves from grandparent', () => {
      container.instance('root-val', 'from-root');

      const child = container.scope();
      const grandchild = child.scope();

      expect(grandchild.make<string>('root-val')).toBe('from-root');
    });
  });

  describe('bound() with scoping', () => {
    it('child reports parent bindings as bound', () => {
      container.instance('parent-binding', true);
      const child = container.scope();

      expect(child.bound('parent-binding')).toBe(true);
      expect(child.bound('nonexistent')).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// CARP-006: IoC Container — Service Providers
// ─────────────────────────────────────────────────────────────

describe('CARP-006: Container — Service Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('ServiceProvider lifecycle', () => {
    it('register() is called to bind services', () => {
      class TestProvider extends ServiceProvider {
        register(): void {
          this.app.singleton('test-service', () => new SimpleService());
        }
      }

      const provider = new TestProvider(container);
      provider.register();

      const svc = container.make<SimpleService>('test-service');
      expect(svc).toBeInstanceOf(SimpleService);
    });

    it('boot() can safely resolve registered services', () => {
      let bootedValue: string | null = null;

      class TestProvider extends ServiceProvider {
        register(): void {
          this.app.instance('greeting', 'Hello from boot!');
        }

        boot(): void {
          bootedValue = this.app.make<string>('greeting');
        }
      }

      const provider = new TestProvider(container);
      provider.register();
      provider.boot();

      expect(bootedValue).toBe('Hello from boot!');
    });

    it('register() is called before boot() for all providers', () => {
      const order: string[] = [];

      class ProviderA extends ServiceProvider {
        register(): void {
          order.push('A.register');
          this.app.instance('a-value', 'from-a');
        }
        boot(): void {
          order.push('A.boot');
        }
      }

      class ProviderB extends ServiceProvider {
        register(): void {
          order.push('B.register');
          this.app.instance('b-value', 'from-b');
        }
        boot(): void {
          order.push('B.boot');
          // Can safely resolve A's bindings in boot
          const aVal = this.app.make<string>('a-value');
          expect(aVal).toBe('from-a');
        }
      }

      const providers = [new ProviderA(container), new ProviderB(container)];

      // Phase 1: register all
      for (const p of providers) {
        p.register();
      }

      // Phase 2: boot all
      for (const p of providers) {
        p.boot();
      }

      expect(order).toEqual(['A.register', 'B.register', 'A.boot', 'B.boot']);
    });
  });

  describe('deferred providers', () => {
    it('provides() returns tokens for deferred loading', () => {
      class DeferredProvider extends ServiceProvider {
        register(): void {
          this.app.singleton('lazy-service', () => new SimpleService());
        }

        provides(): (string | symbol | Function)[] {
          return ['lazy-service'];
        }
      }

      const provider = new DeferredProvider(container);
      expect(provider.isDeferred()).toBe(true);
      expect(provider.provides()).toEqual(['lazy-service']);
    });

    it('non-deferred providers return empty provides()', () => {
      class EagerProvider extends ServiceProvider {
        register(): void {
          this.app.instance('eager', true);
        }
      }

      const provider = new EagerProvider(container);
      expect(provider.isDeferred()).toBe(false);
      expect(provider.provides()).toEqual([]);
    });
  });

  describe('real-world provider scenarios', () => {
    it('provider registers interface → implementation binding', () => {
      const I_CACHE = Symbol('ICacheStore');

      class MemoryCacheStore {
        private store = new Map<string, unknown>();
        get(key: string) { return this.store.get(key) ?? null; }
        put(key: string, value: unknown) { this.store.set(key, value); }
      }

      class CacheServiceProvider extends ServiceProvider {
        register(): void {
          this.app.singleton(I_CACHE, () => new MemoryCacheStore());
        }
      }

      const provider = new CacheServiceProvider(container);
      provider.register();

      const cache = container.make<MemoryCacheStore>(I_CACHE);
      cache.put('key', 'value');
      expect(cache.get('key')).toBe('value');
    });

    it('boot() subscribes to events or decorates services', () => {
      let decorated = false;

      class AppServiceProvider extends ServiceProvider {
        register(): void {
          this.app.singleton('service', () => new SimpleService());
        }

        boot(): void {
          this.app.resolving<SimpleService>('service', (svc) => {
            svc.value = 'decorated';
            decorated = true;
          });
        }
      }

      const provider = new AppServiceProvider(container);
      provider.register();
      provider.boot();

      // Force a fresh resolution to trigger the callback
      container.flush();
      provider.register();
      provider.boot();
      const svc = container.make<SimpleService>('service');

      expect(svc.value).toBe('decorated');
      expect(decorated).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Exception Type Tests
// ─────────────────────────────────────────────────────────────

describe('Exception Hierarchy', () => {
  it('CarpenterError carries code and context', () => {
    const err = new ContainerError('test error', { key: 'val' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ContainerError);
    expect(err.message).toBe('test error');
    expect(err.code).toBe('CONTAINER_ERROR');
    expect(err.context).toEqual({ key: 'val' });
  });

  it('BindingNotFoundError has descriptive message', () => {
    const err = new BindingNotFoundError('IUserRepo');
    expect(err.message).toContain('IUserRepo');
    expect(err.code).toBe('BINDING_NOT_FOUND');
  });

  it('CircularDependencyError shows the chain', () => {
    const err = new CircularDependencyError(['A', 'B', 'C', 'A']);
    expect(err.message).toContain('A → B → C → A');
    expect(err.code).toBe('CIRCULAR_DEPENDENCY');
  });
});
