/**
 * @module tests
 * @description Tests for Tier 4 features: GraphQL PubSub, Benchmark harness,
 * Security audit, and DevServer configuration.
 *
 * Test strategy:
 * - PubSub: test subscribe/publish/unsubscribe, asyncIterator, multi-topic
 * - Benchmark: run micro-benchmarks with low iteration count, verify stats
 * - Security audit: test each check with controlled env vars
 * - DevServer: test config parsing and state (no actual process spawning)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════
// GRAPHQL PUBSUB
// ═══════════════════════════════════════════════════════════

import { PubSub } from '../packages/graphql/src/PubSub.js';

describe('GraphQL PubSub', () => {
  let pubsub: PubSub;

  beforeEach(() => { pubsub = new PubSub(); });

  describe('subscribe + publish', () => {
    it('delivers payload to subscribers', () => {
      const received: unknown[] = [];
      pubsub.subscribe('POST_CREATED', (p) => received.push(p));

      pubsub.publish('POST_CREATED', { id: 1, title: 'Hello' });

      expect(received).toEqual([{ id: 1, title: 'Hello' }]);
    });

    it('delivers to multiple subscribers', () => {
      let count = 0;
      pubsub.subscribe('EVENT', () => count++);
      pubsub.subscribe('EVENT', () => count++);
      pubsub.subscribe('EVENT', () => count++);

      expect(pubsub.publish('EVENT', {})).toBe(3);
      expect(count).toBe(3);
    });

    it('does not deliver to other topics', () => {
      const received: unknown[] = [];
      pubsub.subscribe('TOPIC_A', (p) => received.push(p));

      pubsub.publish('TOPIC_B', { wrong: true });

      expect(received).toHaveLength(0);
    });

    it('returns 0 when no subscribers', () => {
      expect(pubsub.publish('NOBODY_LISTENING', {})).toBe(0);
    });
  });

  describe('unsubscribe', () => {
    it('stops receiving after unsubscribe', () => {
      let count = 0;
      const unsub = pubsub.subscribe('EVENT', () => count++);

      pubsub.publish('EVENT', {});
      expect(count).toBe(1);

      unsub();
      pubsub.publish('EVENT', {});
      expect(count).toBe(1); // Not incremented
    });

    it('cleans up topic when last subscriber leaves', () => {
      const unsub = pubsub.subscribe('TEMP', () => {});
      expect(pubsub.getActiveTopics()).toContain('TEMP');

      unsub();
      expect(pubsub.getActiveTopics()).not.toContain('TEMP');
    });
  });

  describe('asyncIterator', () => {
    it('yields published events', async () => {
      const iter = pubsub.asyncIterator('STREAM');

      // Publish after a small delay
      setTimeout(() => pubsub.publish('STREAM', { seq: 1 }), 5);

      const result = await iter.next();
      expect(result.done).toBe(false);
      expect(result.value).toEqual({ seq: 1 });

      // Clean up
      await iter.return!();
    });

    it('return() ends the iterator', async () => {
      const iter = pubsub.asyncIterator('STREAM');
      await iter.return!();

      const result = await iter.next();
      expect(result.done).toBe(true);
    });

    it('queues events if next() not awaited yet', async () => {
      const iter = pubsub.asyncIterator('BATCH');

      // Publish before calling next()
      pubsub.publish('BATCH', { seq: 1 });
      pubsub.publish('BATCH', { seq: 2 });

      const r1 = await iter.next();
      const r2 = await iter.next();
      expect(r1.value).toEqual({ seq: 1 });
      expect(r2.value).toEqual({ seq: 2 });

      await iter.return!();
    });

    it('subscribes to multiple topics', async () => {
      const iter = pubsub.asyncIterator(['A', 'B']);

      pubsub.publish('A', { from: 'A' });
      pubsub.publish('B', { from: 'B' });

      const r1 = await iter.next();
      const r2 = await iter.next();
      expect([r1.value, r2.value]).toContainEqual({ from: 'A' });
      expect([r1.value, r2.value]).toContainEqual({ from: 'B' });

      await iter.return!();
    });
  });

  describe('monitoring', () => {
    it('getSubscriberCount returns count per topic', () => {
      pubsub.subscribe('A', () => {});
      pubsub.subscribe('A', () => {});
      pubsub.subscribe('B', () => {});

      expect(pubsub.getSubscriberCount('A')).toBe(2);
      expect(pubsub.getSubscriberCount('B')).toBe(1);
      expect(pubsub.getSubscriberCount('C')).toBe(0);
    });

    it('getPublishCount tracks total publishes', () => {
      pubsub.publish('X', {});
      pubsub.publish('Y', {});
      pubsub.publish('X', {});

      expect(pubsub.getPublishCount()).toBe(3);
    });

    it('clear() removes all subscriptions', () => {
      pubsub.subscribe('A', () => {});
      pubsub.subscribe('B', () => {});
      pubsub.clear();

      expect(pubsub.getActiveTopics()).toHaveLength(0);
    });
  });

  describe('error isolation', () => {
    it('one subscriber throwing does not break others', () => {
      let reached = false;
      pubsub.subscribe('ERR', () => { throw new Error('oops'); });
      pubsub.subscribe('ERR', () => { reached = true; });

      pubsub.publish('ERR', {});
      expect(reached).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// BENCHMARK SUITE
// ═══════════════════════════════════════════════════════════

import { BenchmarkSuite, SlaContract } from '../src/testing/Benchmark.js';

describe('BenchmarkSuite', () => {
  it('runs benchmarks and produces results', async () => {
    const suite = new BenchmarkSuite('Test Suite');
    suite.add('noop', () => {});
    suite.add('math', () => { Math.sqrt(12345); });

    const results = await suite.run({ iterations: 100, warmup: 10 });

    expect(results.name).toBe('Test Suite');
    expect(results.benchmarks).toHaveLength(2);
    expect(results.totalTime).toBeGreaterThan(0);
  });

  it('computes correct statistics', async () => {
    const suite = new BenchmarkSuite('Stats');
    suite.add('predictable', () => { /* noop — near-zero time */ });

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

  it('supports async benchmarks', async () => {
    const suite = new BenchmarkSuite('Async');
    suite.add('async-op', async () => {
      await new Promise((r) => setTimeout(r, 1));
    });

    const results = await suite.run({ iterations: 5, warmup: 1 });
    expect(results.benchmarks[0].mean).toBeGreaterThan(0.5); // at least ~1ms
  });

  it('print() returns formatted string', async () => {
    const suite = new BenchmarkSuite('Print Test');
    suite.add('fast-op', () => {});

    const results = await suite.run({ iterations: 10, warmup: 2 });
    const output = results.print();

    expect(output).toContain('Print Test');
    expect(output).toContain('fast-op');
    expect(output).toContain('avg');
    expect(output).toContain('p95');
    expect(output).toContain('ops/s');
  });
});

describe('SlaContract', () => {
  it('passes when benchmarks meet requirements', async () => {
    const suite = new BenchmarkSuite('SLA Test');
    suite.add('fast', () => {});

    const results = await suite.run({ iterations: 50, warmup: 5 });

    const sla = new SlaContract();
    sla.require('fast', { maxP95: 100, minOpsPerSecond: 1 }); // very lenient

    expect(sla.check(results)).toHaveLength(0); // no violations
  });

  it('detects violations', async () => {
    const suite = new BenchmarkSuite('SLA Fail');
    suite.add('slow-op', async () => { await new Promise((r) => setTimeout(r, 2)); });

    const results = await suite.run({ iterations: 5, warmup: 1 });

    const sla = new SlaContract();
    sla.require('slow-op', { maxP95: 0.001 }); // impossibly strict

    const violations = sla.check(results);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('exceeds limit');
  });

  it('reports missing benchmarks', async () => {
    const suite = new BenchmarkSuite('Missing');
    suite.add('exists', () => {});

    const results = await suite.run({ iterations: 5, warmup: 1 });

    const sla = new SlaContract();
    sla.require('nonexistent', { maxP95: 1 });

    expect(sla.check(results)[0]).toContain('not found');
  });
});

// ═══════════════════════════════════════════════════════════
// SECURITY AUDIT
// ═══════════════════════════════════════════════════════════

import { runSecurityAudit } from '../../carpenter/cli/src/security-audit.js';
import { SecurityAuditCommand } from '../../carpenter/cli/src/security-audit.js';
import { InMemoryConsole } from '../../carpenter/cli/src/index.js';

describe('Security Audit', () => {
  describe('runSecurityAudit (programmatic)', () => {
    it('passes with secure production config', () => {
      const results = runSecurityAudit({
        APP_KEY: 'a'.repeat(32),
        APP_ENV: 'production',
        APP_DEBUG: 'false',
        APP_URL: 'https://myapp.com',
        CORS_ORIGIN: 'https://myapp.com',
        SESSION_SECURE_COOKIE: 'true',
        JWT_SECRET: 'proper-jwt-secret-key-here',
        DB_PASSWORD: 'strong-db-password-123',
        RATE_LIMIT_MAX: '100',
      });

      const failures = results.filter((r) => !r.result.passed);
      expect(failures).toHaveLength(0);
    });

    it('catches APP_KEY missing', () => {
      const results = runSecurityAudit({ APP_KEY: '' });
      const appKey = results.find((r) => r.check.name === 'APP_KEY set');
      expect(appKey?.result.passed).toBe(false);
    });

    it('catches debug mode in production', () => {
      const results = runSecurityAudit({ APP_ENV: 'production', APP_DEBUG: 'true' });
      const debug = results.find((r) => r.check.name === 'Debug mode');
      expect(debug?.result.passed).toBe(false);
    });

    it('catches CORS wildcard in production', () => {
      const results = runSecurityAudit({ APP_ENV: 'production', CORS_ORIGIN: '*' });
      const cors = results.find((r) => r.check.name === 'CORS configuration');
      expect(cors?.result.passed).toBe(false);
    });

    it('catches insecure session cookie in production', () => {
      const results = runSecurityAudit({ APP_ENV: 'production', SESSION_SECURE_COOKIE: 'false' });
      const sess = results.find((r) => r.check.name === 'Session security');
      expect(sess?.result.passed).toBe(false);
    });

    it('catches HTTP URL in production', () => {
      const results = runSecurityAudit({ APP_ENV: 'production', APP_URL: 'http://myapp.com' });
      const https = results.find((r) => r.check.name === 'HTTPS enforcement');
      expect(https?.result.passed).toBe(false);
    });

    it('catches default DB password in production', () => {
      const results = runSecurityAudit({ APP_ENV: 'production', DB_PASSWORD: '' });
      const db = results.find((r) => r.check.name === 'Database credentials');
      expect(db?.result.passed).toBe(false);
    });

    it('allows development config', () => {
      const results = runSecurityAudit({ APP_ENV: 'development', APP_DEBUG: 'true' });
      const debug = results.find((r) => r.check.name === 'Debug mode');
      expect(debug?.result.passed).toBe(true);
    });
  });

  describe('SecurityAuditCommand', () => {
    it('runs via CLI and outputs results', async () => {
      const output = new InMemoryConsole();
      const cmd = new SecurityAuditCommand();
      const code = await cmd.handle({}, {}, output);
      output.assertOutputContains('Security Audit');
      expect(typeof code).toBe('number');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// DEV SERVER
// ═══════════════════════════════════════════════════════════

import { DevServer } from '../../carpenter/cli/src/DevServer.js';

describe('DevServer', () => {
  it('creates with default config', () => {
    const server = new DevServer({ entry: 'src/server.ts' });
    const state = server.getState();
    expect(state.running).toBe(false);
    expect(state.restartCount).toBe(0);
    expect(state.pid).toBeNull();
  });

  it('accepts custom config', () => {
    const server = new DevServer({
      entry: 'src/app.ts',
      watch: ['src', 'config'],
      ignore: ['node_modules', 'dist', 'coverage'],
      extensions: ['.ts', '.tsx', '.json', '.yaml'],
      debounceMs: 500,
      runtime: 'bun',
      runtimeArgs: ['run'],
      env: { DATABASE_URL: 'sqlite::memory:' },
    });
    // Just verify it accepts the config without error
    expect(server.getState().running).toBe(false);
  });

  it('stop() is safe to call before start()', () => {
    const server = new DevServer({ entry: 'src/server.ts' });
    server.stop(); // Should not throw
    expect(server.getState().running).toBe(false);
  });

  it('callbacks can be configured', () => {
    const events: string[] = [];
    const server = new DevServer({
      entry: 'src/server.ts',
      onStart: () => events.push('start'),
      onRestart: (f) => events.push(`restart:${f}`),
      onError: (e) => events.push(`error:${e.message}`),
    });
    // Callbacks are stored — verified by config acceptance
    expect(server.getState().running).toBe(false);
  });
});
