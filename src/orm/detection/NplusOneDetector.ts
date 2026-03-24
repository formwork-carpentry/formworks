/**
 * @module @carpentry/orm
 * @description N+1 Query Detector — dev-mode middleware that tracks queries per request
 * and warns when a pattern suggests N+1 query problems.
 * @patterns Observer (listens to query events), Proxy (wraps query execution)
 * @principles SRP (only detects N+1), OCP (configurable thresholds)
 */

/** Configuration for the N+1 detector */
export interface NplusOneConfig {
  /** Minimum repeated identical queries to trigger a warning (default: 3) */
  threshold: number;
  /** Whether to throw instead of just logging (default: false) */
  throwOnDetection: boolean;
  /** Custom warning handler */
  onWarning?: (warning: NplusOneWarning) => void;
  /** Enabled flag — typically only in dev mode */
  enabled: boolean;
}

/** Warning data emitted when N+1 is detected */
export interface NplusOneWarning {
  /** The repeated query pattern (with values stripped) */
  queryPattern: string;
  /** Number of times the query was executed */
  count: number;
  /** The specific query values that differed */
  occurrences: Array<{ sql: string; params?: unknown[] }>;
  /** Suggestion to fix the N+1 */
  suggestion: string;
}

/** Tracks a single query execution */
interface QueryRecord {
  sql: string;
  params?: unknown[];
  pattern: string;
  timestamp: number;
}

const DEFAULT_CONFIG: NplusOneConfig = {
  threshold: 3,
  throwOnDetection: false,
  enabled: true,
};

/**
 * Normalizes a SQL query into a pattern by replacing literal values.
 * "SELECT * FROM users WHERE id = 1" → "SELECT * FROM users WHERE id = ?"
 */
function normalizeQuery(sql: string): string {
  return sql
    .replace(/'[^']*'/g, '?')       // Replace string literals
    .replace(/\b\d+\b/g, '?')        // Replace numeric literals
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
}

/**
 * N+1 Query Detector — tracks queries within a request scope
 * and raises warnings when N+1 patterns are detected.
 *
 * @example
 * ```ts
 * const detector = new NplusOneDetector({ threshold: 3 });
 * detector.recordQuery('SELECT * FROM posts WHERE user_id = 1');
 * detector.recordQuery('SELECT * FROM posts WHERE user_id = 2');
 * detector.recordQuery('SELECT * FROM posts WHERE user_id = 3');
 * const warnings = detector.getWarnings(); // 1 warning
 * ```
 */
export class NplusOneDetector {
  private readonly config: NplusOneConfig;
  private readonly queries: QueryRecord[] = [];
  private readonly patternCounts = new Map<string, QueryRecord[]>();
  private readonly warnings: NplusOneWarning[] = [];

  constructor(config: Partial<NplusOneConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a query execution. Call this for every DB query in the request.
   * @param {string} sql - The SQL query string
   * @param {unknown[]} [params] - Query parameters
   * @returns {void}
   */
  recordQuery(sql: string, params?: unknown[]): void {
    if (!this.config.enabled) return;

    const pattern = normalizeQuery(sql);
    const record: QueryRecord = { sql, pattern, timestamp: Date.now() };
    if (params !== undefined) {
      record.params = params;
    }
    this.queries.push(record);

    const existing = this.patternCounts.get(pattern) ?? [];
    existing.push(record);
    this.patternCounts.set(pattern, existing);

    if (existing.length === this.config.threshold) {
      this.raiseWarning(pattern, existing);
    }
  }

  /**
   * Get all N+1 warnings detected so far.
   * @returns {NplusOneWarning[]} Array of warnings
   */
  getWarnings(): NplusOneWarning[] {
    return [...this.warnings];
  }

  /**
   * Get total query count for this request.
   * @returns {number}
   */
  getQueryCount(): number {
    return this.queries.length;
  }

  /**
   * Get all recorded queries.
   * @returns {ReadonlyArray<{sql: string, params?: unknown[]}>} Recorded queries
   */
  getQueries(): ReadonlyArray<{ sql: string; params?: unknown[] }> {
    return this.queries.map((q) => {
      const occurrence: { sql: string; params?: unknown[] } = { sql: q.sql };
      if (q.params !== undefined) {
        occurrence.params = q.params;
      }
      return occurrence;
    });
  }

  /**
   * Check all patterns and return warnings (for end-of-request check).
   * @returns {NplusOneWarning[]} All detected N+1 warnings
   */
  analyze(): NplusOneWarning[] {
    for (const [pattern, records] of this.patternCounts) {
      if (records.length >= this.config.threshold) {
        const existing = this.warnings.find(w => w.queryPattern === pattern);
        if (existing) {
          existing.count = records.length;
          existing.occurrences = records.map((r) => {
            const occurrence: { sql: string; params?: unknown[] } = { sql: r.sql };
            if (r.params !== undefined) {
              occurrence.params = r.params;
            }
            return occurrence;
          });
        } else {
          this.raiseWarning(pattern, records);
        }
      }
    }
    return this.getWarnings();
  }

  /**
   * Reset the detector (typically at the start of a new request).
   * @returns {void}
   */
  reset(): void {
    this.queries.length = 0;
    this.patternCounts.clear();
    this.warnings.length = 0;
  }

  private raiseWarning(pattern: string, records: QueryRecord[]): void {
    const tableName = this.extractTableName(pattern);
    const suggestion = tableName
      ? `Consider using eager loading: .with('${tableName}') to avoid N+1 queries.`
      : 'Consider using eager loading or batch queries to reduce query count.';

    const warning: NplusOneWarning = {
      queryPattern: pattern,
      count: records.length,
      occurrences: records.map((r) => {
        const occurrence: { sql: string; params?: unknown[] } = { sql: r.sql };
        if (r.params !== undefined) {
          occurrence.params = r.params;
        }
        return occurrence;
      }),
      suggestion,
    };

    this.warnings.push(warning);

    if (this.config.onWarning) {
      this.config.onWarning(warning);
    }

    if (this.config.throwOnDetection) {
      throw Object.assign(
        new Error(`N+1 query detected: "${pattern}" executed ${records.length} times. ${suggestion}`),
        { code: 'N_PLUS_ONE_DETECTED', warning },
      );
    }
  }

  private extractTableName(pattern: string): string | null {
    const match = pattern.match(/FROM\s+(\w+)/i);
    return match?.[1] ?? null;
  }
}
