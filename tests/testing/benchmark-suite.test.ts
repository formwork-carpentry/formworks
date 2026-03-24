import { describe, it, expect } from 'vitest';
import { BenchmarkSuite, SlaContract } from '../../src/testing/Benchmark.js';

describe('testing/BenchmarkSuite', () => {
  it('runs benchmarks and produces results', async () => {
    const suite = new BenchmarkSuite('Test Suite');
    suite.add('noop', () => {});
    suite.add('math', () => {
      Math.sqrt(12345);
    });

    const results = await suite.run({ iterations: 100, warmup: 10 });

    expect(results.name).toBe('Test Suite');
    expect(results.benchmarks).toHaveLength(2);
    expect(results.totalTime).toBeGreaterThan(0);
  });

  it('computes benchmark statistics', async () => {
    const suite = new BenchmarkSuite('Stats');
    suite.add('predictable', () => {});

    const results = await suite.run({ iterations: 50, warmup: 5 });
    const bench = results.benchmarks[0];

    expect(bench.name).toBe('predictable');
    expect(bench.iterations).toBe(50);
    expect(bench.samples).toHaveLength(50);
    expect(bench.min).toBeLessThanOrEqual(bench.mean);
    expect(bench.mean).toBeLessThanOrEqual(bench.max);
    expect(bench.p95).toBeLessThanOrEqual(bench.p99);
    expect(bench.opsPerSecond).toBeGreaterThan(0);
    expect(bench.stddev).toBeGreaterThanOrEqual(0);
  });

  it('supports async benchmarks and printable output', async () => {
    const suite = new BenchmarkSuite('Async');
    suite.add('async-op', async () => {
      await new Promise((r) => setTimeout(r, 1));
    });

    const results = await suite.run({ iterations: 5, warmup: 1 });
    expect(results.benchmarks[0].mean).toBeGreaterThan(0.5);

    const output = results.print();
    expect(output).toContain('Async');
    expect(output).toContain('avg');
    expect(output).toContain('p95');
    expect(output).toContain('ops/s');
  });
});

describe('testing/SlaContract', () => {
  it('passes when benchmarks meet requirements', async () => {
    const suite = new BenchmarkSuite('SLA Test');
    suite.add('fast', () => {});

    const results = await suite.run({ iterations: 50, warmup: 5 });
    const sla = new SlaContract();
    sla.require('fast', { maxP95: 100, minOpsPerSecond: 1 });

    expect(sla.check(results)).toHaveLength(0);
  });

  it('detects violations and missing benchmarks', async () => {
    const suite = new BenchmarkSuite('SLA Fail');
    suite.add('slow-op', async () => {
      await new Promise((r) => setTimeout(r, 2));
    });

    const results = await suite.run({ iterations: 5, warmup: 1 });

    const strict = new SlaContract();
    strict.require('slow-op', { maxP95: 0.001 });
    expect(strict.check(results)[0]).toContain('exceeds limit');

    const missing = new SlaContract();
    missing.require('nonexistent', { maxP95: 1 });
    expect(missing.check(results)[0]).toContain('not found');
  });
});
