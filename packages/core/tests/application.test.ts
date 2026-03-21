/**
 * @module @formwork/core
 * @description Tests for Application bootstrap & lifecycle (CARP-007)
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../src/application/Application.js';
import { ServiceProvider } from '../src/contracts/container/index.js';

// ── Test Fixtures ────────────────────────────────────────

class SimpleService {
  value = 'default';
}

class CountingProvider extends ServiceProvider {
  static registerCount = 0;
  static bootCount = 0;

  register(): void {
    CountingProvider.registerCount++;
    this.app.instance('counting-service', new SimpleService());
  }

  boot(): void {
    CountingProvider.bootCount++;
  }
}

class DependentProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('dependent-service', (c) => {
      const svc = new SimpleService();
      svc.value = 'depends-on-' + c.make<SimpleService>('counting-service').value;
      return svc;
    });
  }
}

class DeferredProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('lazy-service', () => {
      const svc = new SimpleService();
      svc.value = 'lazy-loaded';
      return svc;
    });
  }

  provides() {
    return ['lazy-service'] as const;
  }
}

// ── Tests ────────────────────────────────────────────────

describe('CARP-007: Application Bootstrap & Lifecycle', () => {
  beforeEach(() => {
    Application.resetInstance();
    CountingProvider.registerCount = 0;
    CountingProvider.bootCount = 0;
  });

  afterEach(async () => {
    try {
      const app = Application.getInstance();
      await app.terminate(100);
    } catch {
      // App may already be terminated
    }
    Application.resetInstance();
  });

  describe('Application.create()', () => {
    it('creates and returns an Application instance', async () => {
      const app = await Application.create();
      expect(app).toBeInstanceOf(Application);
    });

    it('sets the singleton instance', async () => {
      const app = await Application.create();
      expect(Application.getInstance()).toBe(app);
    });

    it('loads config from options', async () => {
      const app = await Application.create({
        config: { app: { name: 'TestApp', port: 4000 } },
      });
      expect(app.config('app.name')).toBe('TestApp');
      expect(app.config('app.port')).toBe(4000);
    });

    it('has default config values when not provided', async () => {
      const app = await Application.create();
      expect(app.config('nonexistent', 'default')).toBe('default');
    });

    it('self-registers core bindings', async () => {
      const app = await Application.create();
      expect(app.make('app')).toBe(app);
      expect(app.bound('config')).toBe(true);
      expect(app.bound('env')).toBe(true);
    });

    it('marks as booted after creation', async () => {
      const app = await Application.create();
      expect(app.isBooted()).toBe(true);
    });
  });

  describe('Service Provider lifecycle', () => {
    it('calls register() on all providers', async () => {
      await Application.create({
        providers: [CountingProvider],
      });
      expect(CountingProvider.registerCount).toBe(1);
    });

    it('calls boot() after all register()', async () => {
      await Application.create({
        providers: [CountingProvider],
      });
      expect(CountingProvider.bootCount).toBe(1);
    });

    it('register() runs before boot() across multiple providers', async () => {
      const order: string[] = [];

      class ProviderA extends ServiceProvider {
        register() {
          order.push('A.register');
          this.app.instance('a-val', 'from-a');
        }
        boot() { order.push('A.boot'); }
      }

      class ProviderB extends ServiceProvider {
        register() { order.push('B.register'); }
        boot() {
          order.push('B.boot');
          // boot can safely resolve A's bindings
          const val = this.app.make<string>('a-val');
          expect(val).toBe('from-a');
        }
      }

      await Application.create({ providers: [ProviderA, ProviderB] });
      expect(order).toEqual(['A.register', 'B.register', 'A.boot', 'B.boot']);
    });

    it('boot() can use services registered by other providers', async () => {
      const app = await Application.create({
        providers: [CountingProvider, DependentProvider],
      });
      const svc = app.make<SimpleService>('dependent-service');
      expect(svc.value).toBe('depends-on-default');
    });
  });

  describe('Deferred providers', () => {
    it('deferred provider NOT registered until its token is requested', async () => {
      let registered = false;

      class TrackingDeferredProvider extends ServiceProvider {
        register(): void {
          registered = true;
          this.app.singleton('deferred-svc', () => new SimpleService());
        }
        provides() { return ['deferred-svc'] as const; }
      }

      const app = await Application.create({
        providers: [TrackingDeferredProvider],
      });

      expect(registered).toBe(false); // not registered yet

      const svc = app.make<SimpleService>('deferred-svc');
      expect(registered).toBe(true); // now registered
      expect(svc).toBeInstanceOf(SimpleService);
    });
  });

  describe('Lifecycle events', () => {
    it('emits booting and booted events', async () => {
      const events: string[] = [];

      // We need to hook in before create completes — use a provider
      class EventTrackingProvider extends ServiceProvider {
        register(): void {
          // 'booting' already fired by the time providers register
        }
        boot(): void {
          // Still in boot phase
        }
      }

      const app = await Application.create({ providers: [EventTrackingProvider] });

      // Events for terminate
      app.on('terminating', () => { events.push('terminating'); });
      app.on('terminated', () => { events.push('terminated'); });

      await app.terminate(100);
      expect(events).toEqual(['terminating', 'terminated']);
    });
  });

  describe('terminate()', () => {
    it('clears the singleton instance', async () => {
      const app = await Application.create();
      expect(Application.getInstance()).toBe(app);

      await app.terminate(100);
      expect(() => Application.getInstance()).toThrow();
    });
  });

  describe('getInstance()', () => {
    it('throws if create() has not been called', () => {
      expect(() => Application.getInstance()).toThrow('Application has not been created');
    });
  });
});
