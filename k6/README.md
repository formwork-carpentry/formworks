# k6 Load Testing Suite — Carpenter Framework

Run load tests against the Carpenter starters to validate performance targets.

## Prerequisites

```bash
# Install k6 (macOS/Linux)
brew install grafana/k6/k6
# OR via Docker
docker run --rm -i grafana/k6 run - <k6/smoke.js
```

## Scripts

| Script        | VUs   | Duration | Target                          |
|---------------|-------|----------|---------------------------------|
| `smoke.js`    | 10    | 30s      | Baseline — p95 < 200ms          |
| `load.js`     | 200   | 5m       | Sustained — p99 < 200ms         |
| `stress.js`   | 500   | 5m       | Breaking point — p95 < 500ms    |
| `spike.js`    | 1000  | ~2.5m    | Burst recovery — p95 < 1000ms   |
| `saas-load.js`| 150   | ~3.5m    | Multi-tenant — p99 < 300ms      |

## Running

Start the target starter first:

```bash
# API Starter
tsx starters/api-starter/src/server.ts &

# Then run smoke test
k6 run k6/smoke.js --env BASE_URL=http://localhost:3000

# Or SaaS multi-tenant test
tsx starters/saas-starter/src/server.ts &
k6 run k6/saas-load.js --env BASE_URL=http://localhost:3002
```

## Performance Targets (v1.0)

| Metric          | Target     | Measured |
|-----------------|------------|----------|
| Health p99      | < 50ms     | TBD      |
| Auth p95        | < 100ms    | TBD      |
| CRUD Read p95   | < 100ms    | TBD      |
| CRUD Write p95  | < 200ms    | TBD      |
| Tenant Lookup   | < 50ms     | TBD      |
| Feature Gate    | < 30ms     | TBD      |
| Error rate      | < 1%       | TBD      |
| Throughput      | ~10k req/s | TBD      |

## Grafana Dashboard

If using k6 Cloud or InfluxDB output:

```bash
k6 run --out influxdb=http://localhost:8086/k6 k6/load.js
```
