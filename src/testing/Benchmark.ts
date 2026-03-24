/**
 * @module @carpentry/testing
 * @description Benchmark harness — measure throughput, latency, and memory usage of
 * framework operations (HTTP handling, ORM queries, cache, serialization).
 *
 * WHY: Performance regressions are invisible without measurement. This harness
 * provides a standard way to benchmark framework operations, compare results
 * across versions, and enforce SLA contracts (e.g., "route matching < 0.1ms").
 *
 * HOW: Define benchmarks with `bench()`, run them with `BenchmarkSuite.run()`,
 * get structured results with min/max/mean/p95/p99 statistics.
 *
 * @patterns Template Method (benchmark lifecycle), Strategy (pluggable reporters)
 * @principles SRP (measurement only), OCP (add benchmarks without modifying runner)
 *
 * @example
 * ```ts
 * const suite = new BenchmarkSuite('HTTP Routing');
 *
 * suite.add('route matching', () => {
 *   router.match('GET', '/api/users/42');
 * });
 *
 * suite.add('middleware pipeline (5 layers)', async () => {
 *   await kernel.handle(mockRequest);
 * });
 *
 * const results = await suite.run({ iterations: 10_000, warmup: 1_000 });
 * results.print();
 * // HTTP Routing
 * //   route matching:            0.002ms avg (p95: 0.004ms, p99: 0.008ms)
 * //   middleware pipeline:       0.045ms avg (p95: 0.089ms, p99: 0.120ms)
 * ```
 */

// ── Types ─────────────────────────────────────────────────

/** A single benchmark function — sync or async */
export type BenchFn = () => void | Promise<void>;

/** Configuration for a benchmark run */
export interface BenchmarkOptions {
  /** Number of measured iterations (default: 1000) */
  iterations?: number;
  /** Warmup iterations before measurement (default: 100) */
  warmup?: number;
  /** Timeout per iteration in ms (default: 5000) */
  timeout?: number;
}

/** Statistics for a single benchmark */
export interface BenchmarkResult {
  name: string;
  /** Individual iteration durations in milliseconds */
  samples: number[];
  /** Minimum duration in ms */
  min: number;
  /** Maximum duration in ms */
  max: number;
  /** Mean duration in ms */
  mean: number;
  /** Median duration in ms */
  median: number;
  /** 95th percentile in ms */
  p95: number;
  /** 99th percentile in ms */
  p99: number;
  /** Standard deviation in ms */
  stddev: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Total time in ms */
  totalTime: number;
  /** Number of iterations measured */
  iterations: number;
}

/** Results from running an entire suite */
export interface SuiteResult {
  name: string;
  benchmarks: BenchmarkResult[];
  /** Total wall-clock time including warmup */
  totalTime: number;
  /** Format results as a human-readable string */
  print(): string;
}

// ── Statistics Helpers ────────────────────────────────────

/** Calculate percentile from a sorted array */
function percentile(sorted: number[], p: number): number {
  /**
   * @param {unknown} [sorted.length === 0]
   */
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

/** Calculate standard deviation */
function stddev(values: number[], mean: number): number {
  /**
   * @param {unknown} values.length < 2
   */
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Calculate statistics from a set of duration samples */
function computeStats(name: string, samples: number[], iterations: number): BenchmarkResult {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((s, v) => s + v, 0);
  const mean = total / samples.length;

  return {
    name,
    samples,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    stddev: stddev(samples, mean),
    opsPerSecond: mean > 0 ? 1000 / mean : Number.POSITIVE_INFINITY,
    totalTime: total,
    iterations,
  };
}

// ── Benchmark Suite ───────────────────────────────────────

/**
 * BenchmarkSuite — collects and runs benchmarks, produces structured results.
 *
 * @example
 * ```ts
 * const suite = new BenchmarkSuite('Cache Operations');
 * suite.add('memory cache get', () => cache.get('key'));
 * suite.add('memory cache put', () => cache.put('key', 'value'));
 *
 * const results = await suite.run({ iterations: 5000 });
 * console.log(results.print());
 * ```
 */
export class BenchmarkSuite {
  private benchmarks: Array<{ name: string; fn: BenchFn }> = [];

  constructor(private readonly name: string) {}

  /**
   * Add a benchmark to the suite.
   * @param name - Human-readable benchmark name
   * @param fn - Function to benchmark (sync or async)
   */
  add(name: string, fn: BenchFn): this {
    this.benchmarks.push({ name, fn });
    return this;
  }

  /**
   * Run all benchmarks and collect results.
   *
   * Lifecycle per benchmark:
   * 1. Run `warmup` iterations (results discarded — JIT warmup, cache priming)
   * 2. Run `iterations` iterations (results measured)
   * 3. Compute statistics
   */
  async run(options: BenchmarkOptions = {}): Promise<SuiteResult> {
    const iterations = options.iterations ?? 1000;
    const warmup = options.warmup ?? 100;
    const suiteStart = performance.now();
    const results: BenchmarkResult[] = [];

    for (const bench of this.benchmarks) {
      // Warmup phase — discard results
      for (let i = 0; i < warmup; i++) {
        await bench.fn();
      }

      // Measurement phase
      const samples: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await bench.fn();
        samples.push(performance.now() - start);
      }

      results.push(computeStats(bench.name, samples, iterations));
    }

    const totalTime = performance.now() - suiteStart;

    return {
      name: this.name,
      benchmarks: results,
      totalTime,
      print: () => this.formatResults(results, totalTime),
    };
  }

  /** Format results as a human-readable string */
  private formatResults(results: BenchmarkResult[], totalTime: number): string {
    const lines = [`Benchmark: ${this.name}`, ""];
    const nameWidth = Math.max(...results.map((r) => r.name.length), 20);

    for (const r of results) {
      const name = r.name.padEnd(nameWidth);
      const avg = r.mean.toFixed(4);
      const p95 = r.p95.toFixed(4);
      const p99 = r.p99.toFixed(4);
      const ops = Math.round(r.opsPerSecond).toLocaleString();
      lines.push(`  ${name}  ${avg}ms avg  (p95: ${p95}ms, p99: ${p99}ms)  ${ops} ops/s`);
    }

    lines.push("");
    lines.push(`  Total: ${totalTime.toFixed(1)}ms`);
    return lines.join("\n");
  }
}

/**
 * SLA contract checker — asserts that benchmark results meet performance targets.
 *
 * @example
 * ```ts
 * const sla = new SlaContract();
 * sla.require('route matching', { maxP95: 0.1, minOpsPerSecond: 100_000 });
 * sla.require('db query', { maxP95: 5.0 });
 *
 * const violations = sla.check(suiteResult);
 * if (violations.length > 0) throw new Error('SLA violated: ' + violations.join(', '));
 * ```
 */
export class SlaContract {
  private requirements = new Map<
    string,
    { maxP95?: number; maxP99?: number; minOpsPerSecond?: number }
  >();

  /** Define a performance requirement for a named benchmark */
  /**
   * @param {string} benchmarkName
   * @param {Object} [limits]
   * @returns {this}
   */
  require(
    benchmarkName: string,
    limits: { maxP95?: number; maxP99?: number; minOpsPerSecond?: number },
  ): this {
    this.requirements.set(benchmarkName, limits);
    return this;
  }

  /** Check results against requirements, return list of violations */
  /**
   * @param {SuiteResult} result
   * @returns {string[]}
   */
  check(result: SuiteResult): string[] {
    const violations: string[] = [];

    for (const [name, limits] of this.requirements) {
      const bench = result.benchmarks.find((b) => b.name === name);
      if (!bench) {
        violations.push(`"${name}": benchmark not found in results`);
        continue;
      }
      if (limits.maxP95 !== undefined && bench.p95 > limits.maxP95) {
        violations.push(
          `"${name}": p95 ${bench.p95.toFixed(4)}ms exceeds limit ${limits.maxP95}ms`,
        );
      }
      if (limits.maxP99 !== undefined && bench.p99 > limits.maxP99) {
        violations.push(
          `"${name}": p99 ${bench.p99.toFixed(4)}ms exceeds limit ${limits.maxP99}ms`,
        );
      }
      if (limits.minOpsPerSecond !== undefined && bench.opsPerSecond < limits.minOpsPerSecond) {
        violations.push(
          `"${name}": ${Math.round(bench.opsPerSecond)} ops/s below minimum ${limits.minOpsPerSecond}`,
        );
      }
    }

    return violations;
  }
}
