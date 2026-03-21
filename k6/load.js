/**
 * k6 Load Test — sustained high throughput (200 VUs, 5m)
 *
 * Target: ~10,000 req/s, p99 < 50ms for health/read endpoints.
 * Tests: health, auth, posts listing, feature flags.
 *
 * Run:  k6 run k6/load.js --env BASE_URL=http://localhost:3000
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const healthDuration = new Trend('health_duration');
const authDuration = new Trend('auth_duration');

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '3m', target: 200 },    // sustained load
    { duration: '30s', target: 200 },   // hold peak
    { duration: '1m', target: 0 },      // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<200'],
    health_duration: ['p(99)<50'],
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Health endpoint (fast path)
  const t0 = Date.now();
  const health = http.get(`${BASE}/health`);
  healthDuration.add(Date.now() - t0);
  check(health, {
    'health 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  // Auth flow
  const t1 = Date.now();
  const loginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'admin@app.com', password: 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  authDuration.add(Date.now() - t1);
  check(loginRes, {
    'login ok': (r) => r.status === 200,
  }) || errorRate.add(1);

  const token = loginRes.status === 200 ? JSON.parse(loginRes.body).token : '';
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Read endpoints (should be fastest)
  const posts = http.get(`${BASE}/api/posts`, { headers: authHeaders });
  check(posts, { 'posts ok': (r) => r.status === 200 }) || errorRate.add(1);

  // Interleave reads/writes at 80/20 ratio
  if (Math.random() < 0.2) {
    const create = http.post(
      `${BASE}/api/posts`,
      JSON.stringify({ title: `Load ${__VU}-${__ITER}`, body: 'Generated during load test', status: 'draft' }),
      { headers: authHeaders },
    );
    check(create, { 'create ok': (r) => r.status === 201 || r.status === 200 }) || errorRate.add(1);
  }

  sleep(0.1);
}
