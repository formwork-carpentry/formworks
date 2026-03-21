/**
 * k6 Spike Test — sudden traffic burst (0→1000 VUs in 10s)
 *
 * Simulates viral traffic or DDoS-like burst. Tests recovery after spike.
 *
 * Run:  k6 run k6/spike.js --env BASE_URL=http://localhost:3000
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '10s', target: 10 },    // warm up
    { duration: '10s', target: 1000 },   // SPIKE
    { duration: '30s', target: 1000 },   // hold spike
    { duration: '10s', target: 10 },     // drop back
    { duration: '1m', target: 10 },      // recovery period
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],   // very relaxed during spike
    errors: ['rate<0.20'],                // allow 20% errors during spike
  },
};

export default function () {
  const res = http.get(`${BASE}/health`);
  check(res, { 'status 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Mix in auth
  if (Math.random() < 0.3) {
    const login = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ email: 'admin@app.com', password: 'password' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    check(login, { 'login ok': (r) => r.status === 200 }) || errorRate.add(1);
  }

  sleep(0.02);
}
