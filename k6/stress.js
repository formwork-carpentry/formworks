/**
 * k6 Stress Test — push beyond expected load (500 VUs, 5m)
 *
 * Finds breaking point: ramp to 500 VUs, observe degradation.
 * Expect some failures — goal is to profile graceful degradation.
 *
 * Run:  k6 run k6/stress.js --env BASE_URL=http://localhost:3000
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 500 },   // peak stress
    { duration: '1m', target: 500 },   // hold
    { duration: '30s', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // relaxed — stress test
    errors: ['rate<0.10'],              // allow up to 10% errors
  },
};

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 }) || errorRate.add(1);

  const loginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'admin@app.com', password: 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, { 'login ok': (r) => r.status === 200 }) || errorRate.add(1);

  if (loginRes.status === 200) {
    const token = JSON.parse(loginRes.body).token;
    const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Heavy read
    http.get(`${BASE}/api/posts`, { headers: h });

    // Concurrent writes
    if (Math.random() < 0.3) {
      http.post(
        `${BASE}/api/posts`,
        JSON.stringify({ title: `Stress ${__VU}-${__ITER}`, body: 'Stress test', status: 'draft' }),
        { headers: h },
      );
    }
  }

  sleep(0.05);
}
