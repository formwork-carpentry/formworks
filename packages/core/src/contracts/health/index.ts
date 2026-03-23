/**
 * @module @carpentry/core/contracts/health
 * @description Health check contract — application health probes for readiness and liveness.
 *
 * Implementations: HttpHealthChecker, CompositeHealthChecker
 *
 * @example
 * ```ts
 * const health = container.make<IHealthChecker>('health');
 * const report = await health.check();
 * console.log(report.status); // 'healthy' | 'degraded' | 'unhealthy'
 * ```
 */

/** Health check result for a single component. */
export interface HealthCheckResult {
  /** Component name (e.g., 'database', 'redis', 'disk') */
  name: string;
  /** Component status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Human-readable message */
  message?: string;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/** Aggregated health report. */
export interface HealthReport {
  /** Overall status (worst of all component statuses) */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Individual component results */
  checks: HealthCheckResult[];
  /** Timestamp of this report */
  timestamp: Date;
}

/** @typedef {Object} IHealthCheck - A single pluggable health check */
export interface IHealthCheck {
  /** Human-readable check name */
  name: string;
  /** Run the check and return a result */
  check(): Promise<HealthCheckResult>;
}

/** @typedef {Object} IHealthChecker - Aggregated health checker contract */
export interface IHealthChecker {
  /** Register a health check. */
  register(check: IHealthCheck): void;
  /** Run all registered checks and return an aggregated report. */
  check(): Promise<HealthReport>;
}
