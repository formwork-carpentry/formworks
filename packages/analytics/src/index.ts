/**
 * @module @carpentry/analytics
 * @description Server-side event tracking — PostHog, Mixpanel, Segment, Amplitude.
 *
 * Driver-based: application code calls analytics.track() and the configured
 * adapter routes events to the chosen analytics service.
 *
 * @patterns Strategy (analytics drivers), Adapter (wraps vendor SDKs)
 * @principles OCP — add drivers without modifying core; DIP — depend on IAnalyticsTracker
 *
 * @example
 * ```ts
 * import { AnalyticsManager } from '@carpentry/analytics';
 *
 * const analytics = new AnalyticsManager({ driver: 'log' });
 * analytics.track('order.placed', { orderId: 'abc', userId: 'u1', value: 99.99 });
 * analytics.identify('u1', { name: 'Alice', plan: 'pro' });
 * analytics.page('u1', '/dashboard');
 * ```
 */

// ── Contract ──────────────────────────────────────────────

export interface IAnalyticsTracker {
  /** Track a named event with properties. */
  track(event: string, properties?: Record<string, unknown>): void;
  /** Identify a user with traits. */
  identify(userId: string, traits?: Record<string, unknown>): void;
  /** Track a page view. */
  page(userId: string, path: string, properties?: Record<string, unknown>): void;
  /** Associate an anonymous ID with a known user. */
  alias(userId: string, previousId: string): void;
  /** Flush buffered events (for batch drivers). */
  flush(): Promise<void>;
}

export interface AnalyticsConfig {
  driver: string;
  /** Whether to buffer events and flush periodically. Default: false */
  buffered?: boolean;
  /** Flush interval in ms (if buffered). Default: 10000 */
  flushInterval?: number;
}

// ── Analytics Manager ─────────────────────────────────────

export class AnalyticsManager implements IAnalyticsTracker {
  private drivers = new Map<string, IAnalyticsTracker>();
  private defaultDriver: string;

  constructor(config: AnalyticsConfig) {
    this.defaultDriver = config.driver;
    this.registerDriver('log', new LogAnalyticsDriver());
    this.registerDriver('null', new NullAnalyticsDriver());
  }

  registerDriver(name: string, driver: IAnalyticsTracker): void {
    this.drivers.set(name, driver);
  }

  driver(name?: string): IAnalyticsTracker {
    const d = this.drivers.get(name ?? this.defaultDriver);
    if (!d) throw new Error(`Analytics driver "${name ?? this.defaultDriver}" not registered.`);
    return d;
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.driver().track(event, properties);
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.driver().identify(userId, traits);
  }

  page(userId: string, path: string, properties?: Record<string, unknown>): void {
    this.driver().page(userId, path, properties);
  }

  alias(userId: string, previousId: string): void {
    this.driver().alias(userId, previousId);
  }

  async flush(): Promise<void> {
    return this.driver().flush();
  }
}

// ── Built-in Drivers ──────────────────────────────────────

/** Logs analytics events to stdout — useful during development. */
export class LogAnalyticsDriver implements IAnalyticsTracker {
  track(event: string, properties?: Record<string, unknown>): void {
    console.log(`[analytics] track: ${event}`, properties ?? '');
  }
  identify(userId: string, traits?: Record<string, unknown>): void {
    console.log(`[analytics] identify: ${userId}`, traits ?? '');
  }
  page(userId: string, path: string, properties?: Record<string, unknown>): void {
    console.log(`[analytics] page: ${userId} → ${path}`, properties ?? '');
  }
  alias(userId: string, previousId: string): void {
    console.log(`[analytics] alias: ${previousId} → ${userId}`);
  }
  async flush(): Promise<void> { /* no-op */ }
}

/** Discards all events — useful for testing. */
export class NullAnalyticsDriver implements IAnalyticsTracker {
  track(): void {}
  identify(): void {}
  page(): void {}
  alias(): void {}
  async flush(): Promise<void> {}
}
