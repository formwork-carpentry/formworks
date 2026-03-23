/**
 * @module @carpentry/health
 * @description Health check system — pluggable liveness/readiness probes with built-in
 * checks for database, cache, disk, memory, and custom services.
 *
 * Builds on the IHealthChecker contract from @carpentry/core/contracts/health.
 *
 * @patterns Composite (aggregates multiple health checks), Strategy (pluggable checks)
 * @principles OCP (add checks without modifying checker), SRP (health concerns only)
 *
 * @example
 * ```ts
 * import { HealthChecker, DatabaseHealthCheck, DiskHealthCheck } from '@carpentry/health';
 *
 * const health = new HealthChecker();
 * health.register(new DatabaseHealthCheck(db));
 * health.register(new DiskHealthCheck({ path: '/tmp', thresholdPercent: 90 }));
 *
 * // Expose as endpoint:
 * app.get('/health', async () => {
 *   const report = await health.check();
 *   return { status: report.status === 'healthy' ? 200 : 503, body: report };
 * });
 * ```
 */

import type {
  HealthCheckResult,
  HealthReport,
  IHealthCheck,
  IHealthChecker,
} from '@carpentry/core/contracts';

export type {
  HealthCheckResult,
  HealthReport,
  IHealthCheck,
  IHealthChecker,
} from '@carpentry/core/contracts';

/** Aggregates multiple health checks and produces a unified report. */
export class HealthChecker implements IHealthChecker {
  private readonly checks: IHealthCheck[] = [];

  register(check: IHealthCheck): void {
    this.checks.push(check);
  }

  async check(): Promise<HealthReport> {
    const results: HealthCheckResult[] = [];

    for (const check of this.checks) {
      const start = Date.now();
      try {
        const result = await check.check();
        result.responseTime = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          name: check.name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : String(error),
          responseTime: Date.now() - start,
        });
      }
    }

    const status = results.some((r) => r.status === 'unhealthy')
      ? 'unhealthy'
      : results.some((r) => r.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return { status, checks: results, timestamp: new Date() };
  }
}

/** Health check that verifies a database connection is alive. */
export class DatabaseHealthCheck implements IHealthCheck {
  readonly name = 'database';
  private readonly db: { query(sql: string): Promise<unknown> };

  constructor(db: { query(sql: string): Promise<unknown> }) {
    this.db = db;
  }

  async check(): Promise<HealthCheckResult> {
    try {
      await this.db.query('SELECT 1');
      return { name: this.name, status: 'healthy' };
    } catch (error) {
      return {
        name: this.name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database unreachable',
      };
    }
  }
}

/** Health check that verifies cache connectivity. */
export class CacheHealthCheck implements IHealthCheck {
  readonly name = 'cache';
  private readonly cache: { has(key: string): Promise<boolean> };

  constructor(cache: { has(key: string): Promise<boolean> }) {
    this.cache = cache;
  }

  async check(): Promise<HealthCheckResult> {
    try {
      await this.cache.has('__health_check__');
      return { name: this.name, status: 'healthy' };
    } catch (error) {
      return {
        name: this.name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Cache unreachable',
      };
    }
  }
}

/** Health check for memory usage. */
export class MemoryHealthCheck implements IHealthCheck {
  readonly name = 'memory';
  private readonly thresholdMb: number;

  constructor(options?: { thresholdMb?: number }) {
    this.thresholdMb = options?.thresholdMb ?? 512;
  }

  async check(): Promise<HealthCheckResult> {
    const usage = process.memoryUsage();
    const heapMb = Math.round(usage.heapUsed / 1024 / 1024);
    const status = heapMb > this.thresholdMb ? 'degraded' : 'healthy';
    return {
      name: this.name,
      status,
      meta: { heapUsedMb: heapMb, thresholdMb: this.thresholdMb },
    };
  }
}
