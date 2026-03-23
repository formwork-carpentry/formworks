/**
 * @module @carpentry/flags
 * @description Feature flags and A/B experimentation — percentage rollout, user/group targeting, deterministic bucketing
 * @patterns Strategy (flag evaluation), Observer (flag change events)
 * @principles OCP (add providers without modifying core), SRP (flag evaluation only)
 *
 * Use this package to:
 * - Gate features behind runtime flags (`feature()`)
 * - Roll out gradually with percentage buckets (`percentage`)
 * - Run experiments with deterministic user assignment (`Experiment.assign()`)
 *
 * @example
 * ```ts
 * import { InMemoryFlagProvider, setFlagProvider, feature, Experiment } from './';
 *
 * const provider = new InMemoryFlagProvider();
 * provider.define('new-payments', {
 *   enabled: true,
 *   percentage: 10, // 10% of users
 * });
 *
 * setFlagProvider(provider);
 *
 * const enabled = await feature('new-payments', { userId: 123 });
 *
 * const checkoutExperiment = new Experiment('checkout_ui', [
 *   { name: 'control', value: 'v1', weight: 50 },
 *   { name: 'variant', value: 'v2', weight: 50 },
 * ]);
 *
 * const assignment = checkoutExperiment.assign(123);
 * ```
 */

export interface FlagContext {
  userId?: string | number;
  groups?: string[];
  [key: string]: unknown;
}

/** Minimal provider interface for the facade */
interface FlagProviderLike {
  /**
   * @param {string} flag
   * @param {FlagContext} [context]
   * @returns {Promise<boolean>}
   */
  isEnabled(flag: string, context?: FlagContext): Promise<boolean>;
}

/**
 * @module @carpentry/flags
 * @description Feature flags with percentage rollout, user targeting, and A/B experiments
 * @patterns Strategy (flag providers), Observer (flag change events)
 * @principles OCP — new providers (LaunchDarkly, Flagsmith) without modifying core
 *             SRP — flag evaluation only; DIP — depends on IFlagProvider interface
 */

// ── Flag Definition ───────────────────────────────────────

export interface FlagDefinition {
  /** Whether the flag is globally enabled */
  enabled: boolean;
  /** Percentage rollout (0-100). Used when enabled=true. */
  percentage?: number;
  /** Enable for specific user IDs */
  allowedUsers?: (string | number)[];
  /** Enable for specific groups/roles */
  allowedGroups?: string[];
  /** Custom evaluation function */
  evaluator?: (context: FlagContext) => boolean;
}

// ── InMemoryFlagProvider ──────────────────────────────────

/**
 * In-memory feature flag provider with:
 * - Global enable/disable (`enabled`)
 * - Percentage rollout (`percentage`)
 * - Optional user and group targeting
 * - Deterministic bucketing based on `userId + flag`
 *
 * @example
 * ```ts
 * const provider = new InMemoryFlagProvider();
 * provider.define('beta', { enabled: true, percentage: 25, allowedUsers: [1, 2] });
 *
 * provider.override('beta', true); // testing override
 * const ok = await provider.isEnabled('beta', { userId: 1 });
 * ```
 *
 * @see feature — Convenience wrapper using the globally configured provider
 */
export class InMemoryFlagProvider {
  private flags = new Map<string, FlagDefinition>();
  private overrides = new Map<string, boolean>();

  /** Define a feature flag */
  /**
   * @param {string} name
   * @param {FlagDefinition} definition
   */
  define(name: string, definition: FlagDefinition): void {
    this.flags.set(name, definition);
  }

  /**
   * Backward-compatible shorthand used by legacy starters.
   * Equivalent to define(name, { enabled: value }).
   */
  set(name: string, value: boolean): void {
    this.define(name, { enabled: value });
  }

  /** Override a flag for testing (bypasses all rules) */
  /**
   * @param {string} name
   * @param {boolean} value
   */
  override(name: string, value: boolean): void {
    this.overrides.set(name, value);
  }

  /** Clear all overrides */
  clearOverrides(): void {
    this.overrides.clear();
  }

  /**
   * @param {string} flag
   * @param {FlagContext} [context]
   * @returns {Promise<boolean>}
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multiple orthogonal flag targeting strategies
  async isEnabled(flag: string, context?: FlagContext): Promise<boolean> {
    // Check overrides first (testing)
    const override = this.overrides.get(flag);
    if (override !== undefined) return override;

    const def = this.flags.get(flag);
    if (!def) return false;
    if (!def.enabled) return false;

    // Custom evaluator
    if (def.evaluator && context) {
      return def.evaluator(context);
    }

    // User-specific targeting
    if (def.allowedUsers && context?.userId) {
      if (def.allowedUsers.includes(context.userId)) return true;
    }

    // Group targeting
    if (def.allowedGroups && context?.groups) {
      const allowedGroups = def.allowedGroups;
      const overlap = context.groups.some((g) => allowedGroups.includes(g));
      if (overlap) return true;
    }

    // Percentage rollout (deterministic based on userId for consistency)
    if (def.percentage !== undefined && def.percentage < 100) {
      if (!context?.userId) return false;
      const hash = this.hashUserId(String(context.userId), flag);
      return hash < def.percentage;
    }

    // Globally enabled with no restrictions
    return true;
  }

  /**
   * @param {string} flag
   * @param {T} defaultValue
   * @returns {Promise<T>}
   */
  async getValue<T>(flag: string, defaultValue: T, _context?: FlagContext): Promise<T> {
    const enabled = await this.isEnabled(flag, _context);
    return enabled ? defaultValue : defaultValue; // Extend for multi-variate flags
  }

  /** Get all defined flag names */
  getFlags(): string[] {
    return [...this.flags.keys()];
  }

  /** Reset all flags and overrides */
  reset(): void {
    this.flags.clear();
    this.overrides.clear();
  }

  /**
   * Deterministic hash — same user+flag always gets same bucket.
   * Returns 0-99 for percentage comparison.
   */
  private hashUserId(userId: string, flag: string): number {
    const str = `${userId}:${flag}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }
}

// ── Experiment (A/B Testing) ──────────────────────────────

export interface ExperimentVariant<T = unknown> {
  name: string;
  value: T;
  weight: number; // 0-100
}

/**
 * Deterministic A/B experiment helper.
 *
 * Users are assigned to a variant based on `hash(userId)` so assignment is stable.
 *
 * @example
 * ```ts
 * const experiment = new Experiment('search_ui', [
 *   { name: 'control', value: 'v1', weight: 50 },
 *   { name: 'variant', value: 'v2', weight: 50 },
 * ]);
 *
 * const { variant, value } = experiment.assign(123);
 * ```
 *
 * @see ExperimentVariant — Variant definitions
 */
export class Experiment<T = unknown> {
  private variants: ExperimentVariant<T>[];

  constructor(
    public readonly name: string,
    variants: ExperimentVariant<T>[],
  ) {
    this.variants = variants;
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error(`Experiment "${name}" variant weights must sum to 100, got ${totalWeight}.`);
    }
  }

  /** Assign a variant to a user (deterministic by userId) */
  /**
   * @param {string | number} userId
   */
  assign(userId: string | number): { variant: string; value: T } {
    const bucket = this.hashToBucket(String(userId));
    let cumulative = 0;
    for (const variant of this.variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return { variant: variant.name, value: variant.value };
      }
    }
    // Fallback to last variant
    const last = this.variants[this.variants.length - 1];
    return { variant: last.name, value: last.value };
  }

  /** Get all variant definitions */
  getVariants(): ExperimentVariant<T>[] {
    return [...this.variants];
  }

  private hashToBucket(userId: string): number {
    const str = `${this.name}:${userId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
}

// ── Feature helper ────────────────────────────────────────

let globalFlagProvider: FlagProviderLike | null = null;

/**
 * @param {FlagProviderLike} provider
 */
export function setFlagProvider(provider: FlagProviderLike): void {
  globalFlagProvider = provider;
}

/** Check if a feature flag is enabled */
/**
 * @param {string} flag
 * @param {FlagContext} [context]
 * @returns {Promise<boolean>}
 */
export async function feature(flag: string, context?: FlagContext): Promise<boolean> {
  /**
   * @param {unknown} !globalFlagProvider
   */
  if (!globalFlagProvider) return false;
  return globalFlagProvider.isEnabled(flag, context);
}
