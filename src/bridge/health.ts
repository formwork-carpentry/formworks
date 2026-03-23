/**
 * @module @carpentry/bridge
 * @description Health checking for registered services
 */

import type { HealthStatus } from "./remote.js";
import type { ITransport } from "./types.js";

/**
 * Registers async checks per service name; `checkAll` runs every registered probe.
 *
 * @example
 * ```ts
 * import { HealthChecker } from './';
 *
 * const hc = new HealthChecker();
 * hc.register('api', async () => ({ service: 'api', status: 'healthy', latencyMs: 0, checkedAt: new Date() }));
 * await hc.check('api');
 * ```
 */
export class HealthChecker {
  private checks = new Map<string, () => Promise<HealthStatus>>();

  /**
   * @param {string} service
   * @param {(} check
   */
  register(service: string, check: () => Promise<HealthStatus>): void {
    this.checks.set(service, check);
  }

  /**
   * @param {string} service
   * @returns {Promise<HealthStatus>}
   */
  async check(service: string): Promise<HealthStatus> {
    const checkFn = this.checks.get(service);
    if (!checkFn) {
      return {
        service,
        status: "unhealthy",
        latencyMs: 0,
        checkedAt: new Date(),
        details: { error: "No health check registered." },
      };
    }
    return checkFn();
  }

  async checkAll(): Promise<HealthStatus[]> {
    const results: HealthStatus[] = [];
    for (const [, checkFn] of this.checks) {
      results.push(await checkFn());
    }
    return results;
  }

  /** Quick helper to create a ping-based health check */
  static pingCheck(service: string, transport: ITransport): () => Promise<HealthStatus> {
    return async () => {
      const start = Date.now();
      try {
        await transport.send({
          id: `health-${Date.now()}`,
          service,
          method: "health.ping",
          payload: {},
          timestamp: Date.now(),
        });
        return { service, status: "healthy", latencyMs: Date.now() - start, checkedAt: new Date() };
      } catch {
        return {
          service,
          status: "unhealthy",
          latencyMs: Date.now() - start,
          checkedAt: new Date(),
        };
      }
    };
  }
}
