import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  type CircuitEvent,
} from "../../../src/resilience/circuit-breaker/CircuitBreaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens after threshold failures and rejects while open", async () => {
    const breaker = new CircuitBreaker({ threshold: 2, timeout: 1000 });

    await expect(
      breaker.execute(async () => {
        throw new Error("upstream-down");
      }),
    ).rejects.toThrow("upstream-down");

    await expect(
      breaker.execute(async () => {
        throw new Error("upstream-down");
      }),
    ).rejects.toThrow("upstream-down");

    expect(breaker.getState()).toBe("open");

    await expect(breaker.execute(async () => "ok")).rejects.toBeInstanceOf(CircuitBreakerOpenError);
  });

  it("transitions open -> half-open -> closed after timeout and successful probe", async () => {
    const breaker = new CircuitBreaker({ threshold: 1, timeout: 1000, halfOpenMax: 1 });

    await expect(
      breaker.execute(async () => {
        throw new Error("fail-once");
      }),
    ).rejects.toThrow("fail-once");

    expect(breaker.getState()).toBe("open");

    vi.advanceTimersByTime(1001);

    await expect(breaker.execute(async () => "recovered")).resolves.toBe("recovered");
    expect(breaker.getState()).toBe("closed");
    expect(breaker.getFailureCount()).toBe(0);
  });

  it("dispatches failure/open/half-open/success/close lifecycle events in order", async () => {
    const breaker = new CircuitBreaker({ threshold: 1, timeout: 1000, halfOpenMax: 1 });
    const events: CircuitEvent[] = [];
    breaker.on((event) => events.push(event));

    await expect(
      breaker.execute(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    vi.advanceTimersByTime(1001);

    await expect(breaker.execute(async () => "ok")).resolves.toBe("ok");

    expect(events).toEqual(["failure", "open", "half-open", "close", "success"]);
  });
});
