/**
 * @module @carpentry/http
 * @description Profiler middleware — collects per-request performance metrics.
 *
 * WHY: Performance regressions are invisible without measurement. The Profiler
 * collects request timeline, database queries, cache operations, and memory
 * usage during each request, then exposes them via headers or JSON endpoint.
 *
 * HOW: Wraps the request lifecycle and collects timing data. In debug mode,
 * appends X-Debug-* headers to every response. Also exposes a /__debug
 * endpoint that returns the last N request profiles as JSON.
 *
 * @patterns Chain of Responsibility (middleware), Observer (event collection)
 * @principles SRP (profiling only), OCP (add metric collectors without modifying profiler)
 */

/** A single profiled event (DB query, cache op, etc.) */
export interface ProfileEvent {
  type: "query" | "cache" | "http" | "custom";
  label: string;
  durationMs: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Complete profile for one request */
export interface RequestProfile {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  totalMs: number;
  memoryMb: number;
  events: ProfileEvent[];
  timestamp: number;
}

/**
 * ProfileCollector — gathers events during a single request.
 * Pass this to services so they can record their operations.
 *
 * @example
 * ```ts
 * const collector = new ProfileCollector();
 * // In a DB adapter:
 * const start = performance.now();
 * const result = await realQuery(sql);
 * collector.record('query', sql, performance.now() - start, { rows: result.length });
 * ```
 */
export class ProfileCollector {
  private events: ProfileEvent[] = [];

  /**
   * @param {ProfileEvent['type']} type
   * @param {string} label
   * @param {number} durationMs
   * @param {Object} [metadata]
   */
  record(
    type: ProfileEvent["type"],
    label: string,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ): void {
    this.events.push({ type, label, durationMs, timestamp: Date.now(), metadata });
  }

  getEvents(): ProfileEvent[] {
    return [...this.events];
  }

  getQueryCount(): number {
    return this.events.filter((e) => e.type === "query").length;
  }
  getCacheHits(): number {
    return this.events.filter((e) => e.type === "cache" && e.metadata?.hit).length;
  }
  getCacheMisses(): number {
    return this.events.filter((e) => e.type === "cache" && !e.metadata?.hit).length;
  }
  getTotalQueryTime(): number {
    return this.events.filter((e) => e.type === "query").reduce((s, e) => s + e.durationMs, 0);
  }

  clear(): void {
    this.events = [];
  }
}

/**
 * Profiler — stores recent request profiles and generates debug headers.
 *
 * @example
 * ```ts
 * const profiler = new Profiler({ maxProfiles: 50, enabled: true });
 *
 * // In middleware:
 * const collector = new ProfileCollector();
 * // ... pass collector to services during request ...
 * const profile = profiler.finishRequest(collector, 'GET', '/api/posts', 200, totalMs);
 *
 * // Get debug headers for response
 * const headers = profiler.getDebugHeaders(profile);
 * // X-Debug-Time: 12.3ms
 * // X-Debug-Queries: 3 (4.2ms)
 * // X-Debug-Cache: 2 hits, 1 miss
 * // X-Debug-Memory: 45.2MB
 *
 * // /__debug endpoint
 * const recent = profiler.getRecentProfiles();
 * ```
 */
export class Profiler {
  private profiles: RequestProfile[] = [];
  private maxProfiles: number;
  private enabled: boolean;
  private requestCounter = 0;

  constructor(config: { maxProfiles?: number; enabled?: boolean } = {}) {
    this.maxProfiles = config.maxProfiles ?? 100;
    this.enabled = config.enabled ?? true;
  }

  /** Start a new request profile — returns a collector for this request */
  startRequest(): ProfileCollector {
    return new ProfileCollector();
  }

  /** Finish a request profile and store it */
  /**
   * @param {ProfileCollector} collector
   * @param {string} method
   * @param {string} path
   * @param {number} statusCode
   * @param {number} totalMs
   * @returns {RequestProfile}
   */
  finishRequest(
    collector: ProfileCollector,
    method: string,
    path: string,
    statusCode: number,
    totalMs: number,
  ): RequestProfile {
    const memUsage =
      typeof process !== "undefined" ? process.memoryUsage().heapUsed / 1024 / 1024 : 0;

    const profile: RequestProfile = {
      requestId: `req-${++this.requestCounter}`,
      method,
      path,
      statusCode,
      totalMs,
      memoryMb: Math.round(memUsage * 10) / 10,
      events: collector.getEvents(),
      timestamp: Date.now(),
    };

    if (this.enabled) {
      this.profiles.push(profile);
      if (this.profiles.length > this.maxProfiles) {
        this.profiles.shift();
      }
    }

    return profile;
  }

  /** Generate X-Debug-* headers from a profile */
  /**
   * @param {RequestProfile} profile
   * @returns {Record<string, string>}
   */
  getDebugHeaders(profile: RequestProfile): Record<string, string> {
    const collector = new ProfileCollector();
    for (const e of profile.events) collector.record(e.type, e.label, e.durationMs, e.metadata);

    return {
      "X-Debug-Time": `${profile.totalMs.toFixed(1)}ms`,
      "X-Debug-Queries": `${collector.getQueryCount()} (${collector.getTotalQueryTime().toFixed(1)}ms)`,
      "X-Debug-Cache": `${collector.getCacheHits()} hits, ${collector.getCacheMisses()} misses`,
      "X-Debug-Memory": `${profile.memoryMb}MB`,
      "X-Debug-Request-Id": profile.requestId,
    };
  }

  /** Get recent profiles (for /__debug endpoint) */
  /**
   * @param {unknown} [limit = 20]
   * @returns {RequestProfile[]}
   */
  getRecentProfiles(limit = 20): RequestProfile[] {
    return this.profiles.slice(-limit).reverse();
  }

  /** Get a specific profile by request ID */
  /**
   * @param {string} requestId
   * @returns {RequestProfile | undefined}
   */
  getProfile(requestId: string): RequestProfile | undefined {
    return this.profiles.find((p) => p.requestId === requestId);
  }

  /** Get aggregate stats across all stored profiles */
  getStats(): { totalRequests: number; avgMs: number; avgQueries: number; avgMemoryMb: number } {
    if (this.profiles.length === 0)
      return { totalRequests: 0, avgMs: 0, avgQueries: 0, avgMemoryMb: 0 };
    const total = this.profiles.length;
    return {
      totalRequests: total,
      avgMs: Math.round((this.profiles.reduce((s, p) => s + p.totalMs, 0) / total) * 10) / 10,
      avgQueries:
        Math.round(
          (this.profiles.reduce(
            (s, p) => s + p.events.filter((e) => e.type === "query").length,
            0,
          ) /
            total) *
            10,
        ) / 10,
      avgMemoryMb:
        Math.round((this.profiles.reduce((s, p) => s + p.memoryMb, 0) / total) * 10) / 10,
    };
  }

  /** Clear all stored profiles */
  clear(): void {
    this.profiles = [];
  }

  /** Check if profiling is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }
}
