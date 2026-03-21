/**
 * k6 SaaS Multi-tenant Load Test — tenant-scoped operations
 *
 * Tests SaaS-specific endpoints: org lookup, feature gates, billing, analytics.
 * Each VU is assigned a tenant slug to simulate real multi-tenant traffic.
 *
 * Run:  k6 run k6/saas-load.js --env BASE_URL=http://localhost:3002
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const tenantLookup = new Trend('tenant_lookup_duration');
const featureGate = new Trend('feature_gate_duration');

const BASE = __ENV.BASE_URL || 'http://localhost:3002';
const TENANTS = ['acme', 'globex'];

export const options = {
  stages: [
    { duration: '20s', target: 50 },
    { duration: '2m', target: 150 },
    { duration: '30s', target: 150 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<150', 'p(99)<300'],
    tenant_lookup_duration: ['p(99)<50'],
    feature_gate_duration: ['p(99)<30'],
    errors: ['rate<0.02'],
  },
};

export default function () {
  const tenant = TENANTS[__VU % TENANTS.length];
  const headers = { 'x-tenant': tenant, 'Content-Type': 'application/json' };

  // Health
  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Org lookup
  const t0 = Date.now();
  const org = http.get(`${BASE}/api/org`, { headers });
  tenantLookup.add(Date.now() - t0);
  check(org, {
    'org 200': (r) => r.status === 200,
    'org has tenant': (r) => JSON.parse(r.body).tenant !== undefined,
  }) || errorRate.add(1);

  // Feature gate check
  const features = ['dashboard', 'advanced_analytics', 'api_access', 'sso'];
  const feature = features[Math.floor(Math.random() * features.length)];
  const t1 = Date.now();
  const gate = http.get(`${BASE}/api/features/${feature}`, { headers });
  featureGate.add(Date.now() - t1);
  check(gate, {
    'feature responded': (r) => r.status === 200 || r.status === 403,
  }) || errorRate.add(1);

  // Auth
  const login = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'admin@acme.com', password: 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'auth ok': (r) => r.status === 200 }) || errorRate.add(1);

  // Plan change (low frequency — 5%)
  if (Math.random() < 0.05) {
    const plans = ['free', 'pro', 'enterprise'];
    const plan = plans[Math.floor(Math.random() * plans.length)];
    http.put(
      `${BASE}/api/billing/plan`,
      JSON.stringify({ plan }),
      { headers },
    );
  }

  sleep(0.1);
}
