/**
 * k6 Smoke Test — API Starter baseline (10 VUs, 30s)
 *
 * Validates basic API health, auth flow, and CRUD under low concurrency.
 * Pass criteria: p95 < 200ms, error rate < 1%
 *
 * Run:  k6 run k6/smoke.js --env BASE_URL=http://localhost:3000
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  // Health check
  const health = http.get(`${BASE}/health`);
  check(health, {
    'health 200': (r) => r.status === 200,
    'health has status': (r) => JSON.parse(r.body).status === 'ok',
  }) || errorRate.add(1);

  // Login
  const loginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'admin@app.com', password: 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, {
    'login 200': (r) => r.status === 200,
    'login has token': (r) => JSON.parse(r.body).token !== undefined,
  }) || errorRate.add(1);

  const token = loginRes.status === 200 ? JSON.parse(loginRes.body).token : '';
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // List posts
  const posts = http.get(`${BASE}/api/posts`, { headers: authHeaders });
  check(posts, { 'posts 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Create post
  const create = http.post(
    `${BASE}/api/posts`,
    JSON.stringify({ title: `k6 Post ${Date.now()}`, body: 'Load test content', status: 'draft' }),
    { headers: authHeaders },
  );
  check(create, { 'create 201': (r) => r.status === 201 || r.status === 200 }) || errorRate.add(1);

  sleep(0.5);
}
