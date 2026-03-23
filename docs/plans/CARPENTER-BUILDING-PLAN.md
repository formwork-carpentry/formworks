# Carpenter Framework — Building Plan

**From:** Incomplete DX  
**To:** CARP-145 (v1.0 GA Release + UI Ecosystem Packages)  
**Items:** 45 remaining · 10 phases · ~136 hours (~5-6 weeks at 6h/day)

**Current state:** 1,678 tests · 192 source files · 41,038 lines · 11 example apps · 25 CLI commands

---

## Phase 1 — DX Polish (~10 hours)

*No external dependencies. Buildable right now.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 1a | Interactive scaffolder | DX | Add `@clack/prompts` to `create-carpenter-app` — preset picker, DB selector, feature checkboxes. Falls back to `--flags` if piped. | 2h |
| 1b | `carpenter add/remove` disk I/O | DX | Wire actual `execSync('npm install')`, `fs.writeFile()` for config, `.env` append/remove. Currently logic-only with commented I/O. | 2h |
| 1c | Bridge form helpers | 042 | `useForm()` composable: `form.post('/url')`, auto-populates `.errors` from 422, `.processing` state, `.reset()`. Framework-agnostic (React/Vue/Svelte). | 3h |
| 1d | Profiler & Debugbar | 063 | Dev-mode middleware collecting request timeline, DB queries, cache hits/misses, memory. Outputs via `X-Debug-*` headers or `/__debug` JSON endpoint. | 3h |

**Done when:** `npx create-carpenter-app my-app` runs interactively. `carpenter add cache` installs the package and writes config. Form helpers and profiler pass tests.

---

## Phase 2 — Real Database Adapters (~11 hours)

*Needs Docker Compose with Postgres + MySQL + Redis + Mailpit.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 2a | PostgreSQL adapter | 023 | `PostgresAdapter` using `pg` — pooling, parameterized queries, transactions. Replace stub. | 4h |
| 2b | MySQL adapter | 024 | `MySQLAdapter` using `mysql2` — pooling, prepared statements. Replace stub. | 3h |
| 2c | Docker Compose | — | `docker-compose.test.yml`: Postgres 16, MySQL 8, Redis 7, Mailpit. CI-ready for GitHub Actions. | 1h |
| 2d | Integration tests | — | RedisCacheStore, BullMqAdapter, SmtpMailAdapter against real Docker services (mock tests already pass). | 3h |

**Done when:** `npx vitest run --project integration` passes against real Postgres, MySQL, Redis, SMTP.  
**Unlocks:** Full integration test suites (CARP-101 through 105).

---

## Phase 2b — New Packages & Extended Adapters (~16 hours)

*Buildable immediately. No external dependencies for stubs; Docker for adapter integration tests.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 2e | Health checks | 126 | `HealthChecker` (composite aggregator) + `DatabaseHealthCheck`, `CacheHealthCheck`, `MemoryHealthCheck`. Expose via `/health` endpoint. | 2h |
| 2f | Field-level encryption | 127 | `AesEncrypter` — AES-256-GCM via Node.js crypto. `IEncrypter` contract. Tier-1 private primitive in bundle. | 2h |
| 2g | Broadcasting | 128-129 | `BroadcastManager` with Log/Null drivers. `Channel`, `PresenceChannel`. Pusher/Soketi/Ably stubs. | 3h |
| 2h | Full-text search | 130-131 | `SearchManager` with `ISearchEngine` contract. Database LIKE fallback. Meilisearch/Typesense stubs. | 2h |
| 2i | Audit logging + Webhooks | 132-133 | `AuditManager` (DB/file) + `WebhookReceiver` (Stripe/GitHub signature verification). | 3h |
| 2j | Extended adapters | 134-137 | `db-turso` (@libsql/client), `queue-sqs` (AWS SQS), `queue-database` (ORM-backed), `cache-memcached` (memjs), `storage-gcs`, `storage-azure`. | 4h |

**Done when:** All 12 new packages scaffolded with types, stubs, and config. HealthChecker and AesEncrypter fully implemented and tested. 5 new core contracts (ISearchEngine, IHealthChecker, IAuditLogger, IWebhookReceiver, IEncrypter) exported from barrel.  
**Unlocks:** Sprint 41 stories (CARP-126 through 137).

---

## Phase 2c — Islands UI Adapters, Charts & Icons (~12 hours)

*Buildable immediately. Peer dependency declarations only; no framework runtime bundling required in core packages.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 2k | React + Vue adapters | 138-139 | `@carpentry/ui-react` and `@carpentry/ui-vue` with `createCarpenterApp`, `usePage`, `useForm`, `Link`, and framework peer dependencies. | 3h |
| 2l | Svelte + Solid adapters | 140-141 | `@carpentry/ui-svelte` and `@carpentry/ui-solid` with matching islands bridge surface. | 3h |
| 2m | Adapter parity layer | 144 | Align `Link`, `usePage`, and `useForm` semantics across all four framework adapters. | 2h |
| 2n | ui-charts package | 142 | `@carpentry/ui-charts` chart dataset helpers for islands-friendly dashboards and reports. | 2h |
| 2o | icons package | 143 | `@carpentry/icons` with `IIconProps`, placeholder navigation icons, and country flags. | 1h |
| 2p | Package smoke tests | 145 | Validate exports, peer dependency declarations, and CLI feature registration for the 6 UI packages. | 1h |

**Done when:** All 6 UI packages exist with required exports and peer dependency metadata. Icons and chart helpers are available for starter apps.  
**Unlocks:** Sprint 42 stories (CARP-138 through 145).

---

## Phase 3 — AI Streaming + Edge Middleware (~10 hours)

*No external dependencies. Buildable in parallel with Phase 2.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 3a | Streaming AI responses | 079 | `stream()` method on IAIProvider returning `AsyncIterator<string>`. SSE parser for Anthropic/OpenAI. `sseResponse()` helper for EdgeKernel. `useStream()` client composable. | 4h |
| 3b | ISR + CDN cache | 076 | `EdgeKernel.isr()` middleware: `stale-while-revalidate` headers, `Surrogate-Key` for Fastly/CF tag-based purge, `edge.purgeTag('posts')` API. | 3h |
| 3c | Edge geo/A/B/bot | 077 | `edgeGeo()` — route by `cf-ipcountry` header. `edgeABTest()` — assign variant by cookie, sticky. `edgeBotGuard()` — block known bot user-agents. | 3h |

**Done when:** AI streaming works with mock SSE chunks. Edge middleware handles ISR, geo-routing, A/B variants, bot blocking. All tests pass.

---

## Phase 4 — Microservice Transports (~18 hours)

*Needs `@grpc/grpc-js`, `nats` npm, Docker NATS.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 4a | gRPC transport | 069 | `GrpcTransport` implementing `ITransport` via `@grpc/grpc-js`. Unary RPC + server-streaming. Replaces stub. | 6h |
| 4b | NATS transport | 070 | `NatsTransport` using `nats` npm. Request/reply for RPC, pub/sub for events. Docker NATS for tests. | 4h |
| 4c | Unix socket transport | 073 | `UnixSocketTransport` using `node:net` IPC. JSON-RPC over Unix domain socket. Ultra-low-latency same-machine. | 3h |
| 4d | CSDL code generation | 071 | `carpenter generate:service` reads `.proto` → generates TypeScript interface, client stub (`RemoteService<IService>`), server handler scaffold. | 5h |

**Done when:** gRPC, NATS, Unix socket pass integration tests. `carpenter generate:service timetable.proto` outputs valid TypeScript.  
**Note:** Kafka transport deferred to v1.1 — most users need gRPC or NATS first.

---

## Phase 5 — Security Audit (~13 hours)

*Needs a running Carpenter application to audit.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 5a | Supply chain + SBOM | 092 | `npm audit --audit-level=high` in CI. SBOM generation (CycloneDX). Dependency allow-list. Lock file integrity. | 3h |
| 5b | OWASP Top 10 | 106 | Automated + manual checks for A01–A10. Document each item's status in `SECURITY-AUDIT.md`. | 6h |
| 5c | Auth + session audit | 107 | Timing attack tests, session fixation, CSRF verification, brute force protection. Fix any gaps. | 3h |
| 5d | Security headers | 110 | Verify `SecureHeadersMiddleware` against `securityheaders.com`. Ensure A+ grade. | 1h |

**Done when:** `SECURITY-AUDIT.md` shows all OWASP items passed. SBOM generated. `npm audit` clean.  
**Unlocks:** v1.0 GA release (can't ship without security sign-off).

---

## Phase 6 — Performance & Chaos (~14 hours)

*Needs Docker infrastructure + k6/autocannon.*  
*Can run in parallel with Phase 5.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 6a | Load testing | 100 | k6 scripts: HTTP routing (50K req/s target), ORM queries (<5ms p95), cache (<1ms p95), queue (<10ms p95). CI-integrated. | 4h |
| 6b | Chaos engineering | 100 | Fault injection: DB connection drop → circuit breaker. Redis timeout → memory fallback. Queue crash → retry on restart. DNS failure → backoff. | 4h |
| 6c | HTTP/3 + WebTransport | 097 | If Node.js QUIC APIs are stable: implement. If not: document as "planned for v1.1" with tracking issue. This is lowest priority in the entire plan. | 1–6h |

**Done when:** Load tests pass SLA targets. Chaos tests verify resilience patterns. HTTP/3 documented or implemented.

---

## Phase 7 — Documentation (~21 hours)

*No external dependencies. Buildable in parallel with Phases 5 and 6.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 7a | TypeDoc API reference | 065 | `typedoc.json` config for all workspace packages. Generated HTML at `/api`. Every public class/method/interface documented. | 3h |
| 7b | Getting started guide | 111 | Tutorial: scaffold → add features → model → routes → migrate → test → deploy. ~2000 words with code snippets. | 4h |
| 7c | Package guides | 112–114 | One guide per major package (ORM, Auth, AI, Edge, Tenancy, etc.). WHY/WHEN/HOW format. ~1000 words each. 8–10 guides. | 8h |
| 7d | Migration guide (0.x → 1.0) | 115 | All breaking changes with before/after code. The `MigrationScanner` CLI (already built) automates detection. | 2h |
| 7e | Documentation website | — | Static site (VitePress or Starlight). Home, Getting Started, Guides, API, Examples. Deploy to Vercel/Netlify. | 4h |

**Done when:** `carpenterjs.dev` is live with getting started, guides, API reference, and migration guide.

---

## Phase 8 — npm Publish + v1.0 GA (~11 hours)

*Needs npm account + GitHub Actions.*

| # | Item | CARP | What to Build | Effort |
|---|------|------|---------------|--------|
| 8a | npm publish pipeline | 067 | Changesets for versioning. GitHub Actions: test → build → publish. All publishable workspace packages to `@carpentry/*` scope. `create-carpenter-app` as standalone. | 4h |
| 8b | Plugin templates | 116–120 | `carpenter make:plugin my-plugin` scaffold. Community preset registry (JSON). 2–3 example plugins (Stripe, Algolia). | 4h |
| 8c | v1.0 GA release | 121–125 | CHANGELOG.md. Semver 1.0.0 on all packages. `npm publish --tag latest`. GitHub Release. Announcement post. Verify `npx create-carpenter-app` from clean machine. | 3h |

**Done when:** `npm install @carpentry/core` works. `npx create-carpenter-app my-app` works from a clean machine. v1.0.0 tag on GitHub.

---

## Summary

| Phase | Focus | Items | Hours | Needs | Parallel? |
|-------|-------|-------|-------|-------|-----------|
| **1** | DX Polish | 042, 063 + CLI | ~10 | Nothing | Start here |
| **2** | Real DB Adapters | 023, 024 + Docker | ~11 | Docker | After 1 |
| **2b** | New Packages & Adapters | 126-137 | ~16 | Nothing | With 2 |
| **2c** | Islands UI Packages | 138-145 | ~12 | Nothing | With 2/2b |
| **3** | AI Streaming + Edge | 079, 076, 077 | ~10 | Nothing | With 2 |
| **4** | Transport Adapters | 069–071, 073 | ~18 | Docker + npm | With 2/3 |
| **5** | Security Audit | 092, 106–110 | ~13 | Running app | After 2 |
| **6** | Performance + Chaos | 097, 100 | ~14 | Docker + k6 | With 5 |
| **7** | Documentation | 065, 111–115 | ~21 | Nothing | With 5/6 |
| **8** | npm Publish + v1.0 | 067, 116–125 | ~11 | npm account | After all |
| | **TOTAL** | **45 items** | **~136h** | | **~23 working days** |

### Critical Path

```
Phase 1 (DX) → Phase 2 (DB) → Phase 5 (Security) → Phase 7 (Docs) → Phase 8 (Release)
                    ↕                   ↕
              Phase 2b (New Packages)  Phase 6 (Perf)
              Phase 2c (UI Packages)
              Phase 3 (AI/Edge)
              Phase 4 (Transports)
```

Phases 2b, 2c, 3, 4, 6, and 7 can run in parallel with the critical path, saving ~2–3 weeks if multiple people work on it.

### What's Deliberately Excluded

These items from the spec were replaced by better alternatives, not left incomplete:

- **CARP-035 to 039** (VDOM, .carp compiler, signals, client router): Replaced by Islands Architecture + Inertia-style UI bridge. The spec's goal — server-rendered pages with selective interactivity — is fully met.
- **Kafka transport**: Deferred to v1.1. gRPC and NATS cover 90% of microservice use cases.
- **LaunchDarkly/Unleash integration**: Deferred to community plugins. `InMemoryFlagProvider` + `Experiment` cover the core use case.
