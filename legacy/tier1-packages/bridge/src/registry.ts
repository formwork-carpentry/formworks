/**
 * @module @carpentry/bridge
 * @description Service registry with load balancing and health tracking
 * @patterns Strategy (load balancing)
 */

export interface ServiceEndpoint {
  service: string;
  transport: string;
  host?: string;
  port?: number;
  metadata?: Record<string, unknown>;
  weight?: number;
  healthy?: boolean;
}

// ── Service Registry ──────────────────────────────────────

/**
 * ServiceRegistry keeps track of service endpoints and (optionally) marks them healthy/unhealthy.
 *
 * It supports simple weighted selection in {@link resolve}.
 *
 * @example
 * ```ts
 * const registry = new ServiceRegistry();
 *
 * registry
 *   .register({ service: 'users', transport: 'memory', host: 'a.example', weight: 2 })
 *   .register({ service: 'users', transport: 'memory', host: 'b.example', weight: 1 });
 *
 * const endpoint = registry.resolve('users');
 * ```
 */
export class ServiceRegistry {
  private endpoints = new Map<string, ServiceEndpoint[]>();

  /**
   * @param {ServiceEndpoint} endpoint
   * @returns {this}
   */
  register(endpoint: ServiceEndpoint): this {
    if (!this.endpoints.has(endpoint.service)) {
      this.endpoints.set(endpoint.service, []);
    }
    this.endpoints.get(endpoint.service)?.push({ healthy: true, weight: 1, ...endpoint });
    return this;
  }

  /**
   * @param {string} service
   * @param {string} [host]
   * @returns {boolean}
   */
  deregister(service: string, host?: string): boolean {
    const eps = this.endpoints.get(service);
    if (!eps) return false;
    if (!host) {
      this.endpoints.delete(service);
      return true;
    }
    const idx = eps.findIndex((e) => e.host === host);
    if (idx < 0) return false;
    eps.splice(idx, 1);
    return true;
  }

  /** Resolve an endpoint (weighted random for load balancing) */
  /**
   * @param {string} service
   * @returns {ServiceEndpoint | null}
   */
  resolve(service: string): ServiceEndpoint | null {
    const eps = this.endpoints.get(service)?.filter((e) => e.healthy !== false);
    if (!eps || eps.length === 0) return null;
    if (eps.length === 1) return eps[0];

    const totalWeight = eps.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    let random = Math.random() * totalWeight;
    for (const ep of eps) {
      random -= ep.weight ?? 1;
      if (random <= 0) return ep;
    }
    return eps[eps.length - 1];
  }

  /** Get all endpoints for a service */
  /**
   * @param {string} service
   * @returns {ServiceEndpoint[]}
   */
  all(service: string): ServiceEndpoint[] {
    return [...(this.endpoints.get(service) ?? [])];
  }

  /** Get all registered service names */
  services(): string[] {
    return [...this.endpoints.keys()];
  }

  /** Mark an endpoint unhealthy */
  /**
   * @param {string} service
   * @param {string} host
   */
  markUnhealthy(service: string, host: string): void {
    const ep = this.endpoints.get(service)?.find((e) => e.host === host);
    if (ep) ep.healthy = false;
  }

  /** Mark an endpoint healthy */
  /**
   * @param {string} service
   * @param {string} host
   */
  markHealthy(service: string, host: string): void {
    const ep = this.endpoints.get(service)?.find((e) => e.host === host);
    if (ep) ep.healthy = true;
  }

  reset(): void {
    this.endpoints.clear();
  }
}
