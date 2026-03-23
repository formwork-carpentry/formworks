/**
 * @module @carpentry/resilience
 * @description Tests for CircuitBreaker, retry, RateLimiter (CARP-053, CARP-054)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../src/circuit-breaker/CircuitBreaker.js';
import type { CircuitEvent } from '../src/circuit-breaker/CircuitBreaker.js';
import { retry, RateLimiter } from '../src/retry/Retry.js';

// ── CircuitBreaker ────────────────────────────────────────

describe('CARP-053: CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ threshold: 3, timeout: 1000, halfOpenMax: 1 });
  });

  describe('closed state (normal)', () => {
    it('starts in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('executes successfully', async () => {
      const result = await breaker.execute(async () => 'ok');
      expect(result).toBe('ok');
      expect(breaker.getState()).toBe('closed');
    });

    it('passes through errors without opening (under threshold)', async () => {
      const failFn = async () => { throw new Error('fail'); };
      await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      expect(breaker.getState()).toBe('closed'); // 2 failures < threshold of 3
      expect(breaker.getFailureCount()).toBe(2);
    });
  });

  describe('open state (circuit tripped)', () => {
    it('opens after threshold consecutive failures', async () => {
      const failFn = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }
      expect(breaker.getState()).toBe('open');
    });

    it('rejects calls immediately while open', async () => {
      // Trip the breaker
      const failFn = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) await breaker.execute(failFn).catch(() => {});

      // Now it should reject without calling fn
      let fnCalled = false;
      await expect(
        breaker.execute(async () => { fnCalled = true; return 'should not reach'; })
      ).rejects.toThrow(CircuitBreakerOpenError);
      expect(fnCalled).toBe(false);
    });
  });

  describe('half-open state (probe)', () => {
    it('transitions to half-open after timeout', async () => {
      vi.useFakeTimers();
      try {
        const failFn = async () => { throw new Error('fail'); };
        for (let i = 0; i < 3; i++) await breaker.execute(failFn).catch(() => {});
        expect(breaker.getState()).toBe('open');

        // Advance past timeout
        vi.advanceTimersByTime(1500);

        // Next call should be allowed (half-open probe)
        const result = await breaker.execute(async () => 'recovered');
        expect(result).toBe('recovered');
        expect(breaker.getState()).toBe('closed'); // successful probe → closed
      } finally {
        vi.useRealTimers();
      }
    });

    it('re-opens on failed probe', async () => {
      vi.useFakeTimers();
      try {
        const failFn = async () => { throw new Error('fail'); };
        for (let i = 0; i < 3; i++) await breaker.execute(failFn).catch(() => {});

        vi.advanceTimersByTime(1500);

        // Probe fails → should re-open
        await expect(breaker.execute(async () => { throw new Error('still broken'); })).rejects.toThrow();
        expect(breaker.getState()).toBe('open');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('success resets failure count', () => {
    it('success after failures resets counter', async () => {
      const failFn = async () => { throw new Error('fail'); };
      await breaker.execute(failFn).catch(() => {});
      await breaker.execute(failFn).catch(() => {});
      expect(breaker.getFailureCount()).toBe(2);

      await breaker.execute(async () => 'ok');
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('events', () => {
    it('emits state transition events', async () => {
      const events: CircuitEvent[] = [];
      breaker.on((event) => events.push(event));

      const failFn = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) await breaker.execute(failFn).catch(() => {});

      expect(events).toContain('failure');
      expect(events).toContain('open');
    });

    it('emits success event', async () => {
      const events: CircuitEvent[] = [];
      breaker.on((event) => events.push(event));

      await breaker.execute(async () => 'ok');
      expect(events).toContain('success');
    });
  });

  describe('reset()', () => {
    it('resets to closed state', async () => {
      const failFn = async () => { throw new Error('fail'); };
      for (let i = 0; i < 3; i++) await breaker.execute(failFn).catch(() => {});
      expect(breaker.getState()).toBe('open');

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getFailureCount()).toBe(0);
    });
  });
});

// ── retry() ───────────────────────────────────────────────

describe('CARP-054: retry()', () => {
  it('returns on first success', async () => {
    let calls = 0;
    const result = await retry(async () => { calls++; return 'ok'; }, { times: 3 });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      if (calls < 3) throw new Error('not yet');
      return 'done';
    }, { times: 5, delay: 1 });
    expect(result).toBe('done');
    expect(calls).toBe(3);
  });

  it('throws after all retries exhausted', async () => {
    await expect(retry(async () => { throw new Error('always fails'); }, { times: 2, delay: 1 }))
      .rejects.toThrow('always fails');
  });

  it('respects retryOn predicate', async () => {
    let calls = 0;
    await expect(
      retry(async () => { calls++; throw new Error('permanent'); }, {
        times: 5, delay: 1,
        retryOn: (err) => err.message !== 'permanent',
      })
    ).rejects.toThrow('permanent');
    expect(calls).toBe(1); // no retry because retryOn returned false
  });

  it('uses exponential backoff (delay increases)', async () => {
    vi.useFakeTimers();
    let calls = 0;

    const promise = retry(async () => {
      calls++;
      if (calls <= 2) throw new Error('fail');
      return 'ok';
    }, { times: 3, delay: 100, backoff: 'exponential' });

    // Advance timers for each retry
    await vi.advanceTimersByTimeAsync(100); // first retry: 100ms
    await vi.advanceTimersByTimeAsync(200); // second retry: 200ms

    const result = await promise;
    expect(result).toBe('ok');
    vi.useRealTimers();
  });
});

// ── RateLimiter ───────────────────────────────────────────

describe('CARP-054: RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => { limiter = new RateLimiter(); });

  it('allows attempts under the limit', () => {
    expect(limiter.attempt('user:1', 3, 60)).toBe(true);
    expect(limiter.attempt('user:1', 3, 60)).toBe(true);
    expect(limiter.attempt('user:1', 3, 60)).toBe(true);
  });

  it('rejects attempts over the limit', () => {
    limiter.attempt('user:1', 2, 60);
    limiter.attempt('user:1', 2, 60);
    expect(limiter.attempt('user:1', 2, 60)).toBe(false);
  });

  it('remaining() shows remaining attempts', () => {
    expect(limiter.remaining('user:1', 5)).toBe(5);
    limiter.attempt('user:1', 5, 60);
    limiter.attempt('user:1', 5, 60);
    expect(limiter.remaining('user:1', 5)).toBe(3);
  });

  it('resets after decay period', () => {
    vi.useFakeTimers();
    try {
      limiter.attempt('user:1', 1, 10); // 10 second window
      expect(limiter.attempt('user:1', 1, 10)).toBe(false); // over limit

      vi.advanceTimersByTime(11000); // advance past decay
      expect(limiter.attempt('user:1', 1, 10)).toBe(true); // window reset
    } finally {
      vi.useRealTimers();
    }
  });

  it('different keys are independent', () => {
    limiter.attempt('user:1', 1, 60);
    expect(limiter.attempt('user:1', 1, 60)).toBe(false);
    expect(limiter.attempt('user:2', 1, 60)).toBe(true); // different key
  });

  it('clear() removes limit for key', () => {
    limiter.attempt('user:1', 1, 60);
    expect(limiter.attempt('user:1', 1, 60)).toBe(false);
    limiter.clear('user:1');
    expect(limiter.attempt('user:1', 1, 60)).toBe(true);
  });

  it('retryAfter() shows seconds until reset', () => {
    vi.useFakeTimers();
    try {
      limiter.attempt('user:1', 1, 30);
      const after = limiter.retryAfter('user:1');
      expect(after).toBeGreaterThan(0);
      expect(after).toBeLessThanOrEqual(30);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reset() clears all limits', () => {
    limiter.attempt('a', 1, 60);
    limiter.attempt('b', 1, 60);
    limiter.reset();
    expect(limiter.attempt('a', 1, 60)).toBe(true);
    expect(limiter.attempt('b', 1, 60)).toBe(true);
  });
});
