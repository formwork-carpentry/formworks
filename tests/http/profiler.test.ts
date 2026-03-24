import { describe, it, expect, beforeEach } from 'vitest';
import { Profiler, ProfileCollector } from '../../src/http/middleware/Profiler.js';

describe('http/ProfileCollector', () => {
  it('records events and computes query/cache stats', () => {
    const c = new ProfileCollector();
    c.record('query', 'SELECT * FROM users', 2.5, { rows: 10 });
    c.record('cache', 'GET user:42', 0.1, { hit: true });
    c.record('cache', 'GET user:99', 0.2, { hit: false });

    expect(c.getEvents()).toHaveLength(3);
    expect(c.getQueryCount()).toBe(1);
    expect(c.getCacheHits()).toBe(1);
    expect(c.getCacheMisses()).toBe(1);
    expect(c.getTotalQueryTime()).toBe(2.5);
  });
});

describe('http/Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler({ maxProfiles: 5 });
  });

  it('records and stores request profiles', () => {
    const collector = profiler.startRequest();
    collector.record('query', 'SELECT 1', 1.0);
    const profile = profiler.finishRequest(collector, 'GET', '/api/users', 200, 12.5);

    expect(profile.method).toBe('GET');
    expect(profile.path).toBe('/api/users');
    expect(profile.totalMs).toBe(12.5);
    expect(profile.events).toHaveLength(1);
  });

  it('generates debug headers', () => {
    const collector = profiler.startRequest();
    collector.record('query', 'SELECT * FROM posts', 3.2);
    collector.record('query', 'SELECT * FROM users', 1.8);
    collector.record('cache', 'GET posts:all', 0.1, { hit: true });
    const profile = profiler.finishRequest(collector, 'GET', '/api/posts', 200, 15.0);

    const headers = profiler.getDebugHeaders(profile);
    expect(headers['X-Debug-Time']).toBe('15.0ms');
    expect(headers['X-Debug-Queries']).toContain('2');
    expect(headers['X-Debug-Cache']).toContain('1 hits');
    expect(headers['X-Debug-Request-Id']).toBeDefined();
  });

  it('limits stored profiles', () => {
    for (let i = 0; i < 10; i++) {
      const c = profiler.startRequest();
      profiler.finishRequest(c, 'GET', `/path/${i}`, 200, i);
    }
    expect(profiler.getRecentProfiles(20)).toHaveLength(5);
  });

  it('computes aggregate stats', () => {
    for (let i = 1; i <= 3; i++) {
      const c = profiler.startRequest();
      c.record('query', 'Q', i * 2);
      profiler.finishRequest(c, 'GET', '/', 200, i * 10);
    }
    const stats = profiler.getStats();
    expect(stats.totalRequests).toBe(3);
    expect(stats.avgMs).toBe(20);
  });
});
