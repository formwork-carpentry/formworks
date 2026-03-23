/**
 * @module @carpentry/core/contracts/analytics
 * @description Analytics tracking contract.
 */

export interface IAnalyticsTracker {
  /** Track a named event with properties. */
  track(event: string, properties?: Record<string, unknown>): void;
  /** Identify a user with traits. */
  identify(userId: string, traits?: Record<string, unknown>): void;
  /** Track a page view. */
  page(userId: string, path: string, properties?: Record<string, unknown>): void;
  /** Associate an anonymous ID with a known user. */
  alias(userId: string, previousId: string): void;
  /** Flush buffered events. */
  flush(): Promise<void>;
}
