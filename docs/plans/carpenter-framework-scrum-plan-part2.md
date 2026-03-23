# 🪚 Carpenter Framework — SCRUM Project Plan: Part II

> **Continuation of Part I** — Sprints 21–40  
> **Focus:** Framework Superiority Analysis · Ecosystem Opportunities & Threats · Polyglot Microservices · Edge Computing · AI Integration · Observability · Multi-tenancy · GraphQL · WebTransport · Admin Panel · WASM · Feature Flags · Real-time · DX Tooling

---

## Table of Contents

1. [Framework Superiority Matrix](#1-framework-superiority-matrix)
2. [Web Ecosystem SWOT Analysis](#2-web-ecosystem-swot-analysis)
3. [New Epics E21–E35](#3-new-epics)
4. [Sprints 21–40](#4-sprints-21-40)
5. [Polyglot Microservices Specification](#5-polyglot-microservices-specification)
6. [Edge Computing Specification](#6-edge-computing-specification)
7. [AI/ML Integration Specification](#7-aiml-integration-specification)
8. [Security Threat Model](#8-security-threat-model)
9. [Observability Specification](#9-observability-specification)
10. [Extended Monorepo Structure](#10-extended-monorepo-structure)

---

## 1. Framework Superiority Matrix

> **AI INSTRUCTION:** Every design decision in Carpenter must be validated against this matrix. If a feature exists in another framework, we take its strength and eliminate its known weakness. No exceptions.

### 1.1 Strengths Absorbed — Weaknesses Eliminated

| Framework | Strength Absorbed | Weakness Eliminated | Carpenter Solution |
|-----------|------------------|---------------------|-------------------|
| **Laravel** | Eloquent ORM, Artisan CLI, Service Container, expressive routing, queues, events, elegant DX | PHP performance ceiling, no true type safety, sync-by-default, global state via facades | Same DX, TypeScript strict mode, async-first, Bun native speed, IoC-backed facades (no global state) |
| **NestJS** | TypeScript-first, decorators, excellent DI, modular architecture | Angular-like verbosity, steep learning curve, massive boilerplate for simple tasks, ~3s cold boot | Same decorator/DI power, zero forced verbosity, Laravel-style simplicity, lazy provider loading, <100ms boot |
| **Next.js** | SSR/SSG/ISR, edge support, React ecosystem, file-based routing | Vercel vendor lock-in, server/client boundary confusion, opaque magic, `app/` router complexity | Same rendering modes, infrastructure-agnostic deploy, explicit boundary, conventional routing with zero magic |
| **Rails** | Convention over configuration, rapid prototyping, generators, scaffolding, opinionated defaults | Ruby GIL performance, too much magic/hidden behavior, N+1 without Bullet gem, asset pipeline | Same conventions + generators, all magic is explicit + documented, built-in N+1 detector, Bun-native asset bundling |
| **Fastify** | Raw HTTP performance, schema validation, excellent plugin system | No batteries, requires assembling many third-party packages, no DI | Same performance (Bun.serve), full batteries included, plugin system via typed Service Providers |
| **Django** | Admin panel, ORM, batteries included, robust auth, migrations | Python GIL, not truly async, template engine dated, slow type story | Native async throughout, built-in CarpenterAdmin (E28), modern reactive UI, TypeScript end to end |
| **AdonisJS** | Laravel-for-Node inspired, TypeScript, decent DX | Smaller ecosystem, incomplete feature parity, some Laravel idioms lost in translation | Direct Laravel-parity DX, full ecosystem planned, no compromises |
| **Remix** | Web standards alignment, loader/action pattern, progressive enhancement | React-only, complex loader model, limited streaming control | Web standards throughout, UI-adapter agnostic, full streaming SSR control |
| **tRPC** | End-to-end type safety, zero-schema RPC | React/Next.js only, breaks REST contracts, no versioning story | @carpentry/trpc — type-safe RPC AND REST simultaneously, any UI, versioned |
| **Prisma** | Type-safe queries, auto-generated types, migrations with diffing | Binary runtime engine, vendor lock-in, raw query escape hatch friction, no true polymorphism | Carpenter ORM generates types, pure TypeScript, no external runtime binary, full polymorphism |
| **Hono** | Ultra-fast, edge-native, web standards, tiny bundle | Micro-framework — no ORM, no DI, no queues, no auth | Carpenter uses Hono as optional HTTP transport layer internally — keeps speed, adds everything else |
| **SvelteKit** | File-based routing, SSR, progressive enhancement, form actions, small bundle | Svelte-only, limited ecosystem, niche skillset | CarpenterUI inspired by Svelte's compilation model; .carp SFC format; React/Vue/Svelte all supported |
| **Spring Boot** | Mature DI container, auto-configuration, production-readiness features | JVM startup time, verbose, Java complexity | Same auto-configuration (ServiceProviders), sub-100ms startup, TypeScript clarity |

### 1.2 Anti-Pattern Registry

> **AI INSTRUCTION:** These are explicitly **BANNED** in the Carpenter codebase. Any AI-generated code exhibiting these patterns must be **rejected and refactored before merge**.

| Anti-Pattern | Seen In | Why Banned | Carpenter Alternative |
|--------------|---------|------------|----------------------|
| God Class | Rails `ApplicationController`, Express monolith files | Violates SRP, untestable, merge conflicts | `BaseController` with 1 concern; traits/mixins for cross-cutting |
| Magic String Configuration | Most Node frameworks | Not type-safe, refactoring nightmare, no IntelliSense | Typed config with `config<DatabaseConfig>('database')` |
| Anemic Domain Model | Typical NestJS services | Domain logic bleeds into services; models are dumb structs | Rich domain models with behaviour, relations, and validation |
| Service Locator (anti-DI) | Express middleware with `req.services` | Hidden dependencies, untestable, breaks DIP | Full DI — all deps declared in constructor, resolved by IoC |
| Callback Hell | Legacy Node.js | Unreadable, error-prone, no stack traces | `async/await` throughout — no `.then()` chains in application code |
| Fat Controller | Laravel beginners | Business logic in HTTP layer | Controllers dispatch to Services; never contain domain logic |
| N+1 Queries | All ORMs without discipline | Silent performance death | Built-in N+1 detector (dev), eager loading warnings, `with()` enforcement |
| Mutable Global State | Express `app.set()`, module-level vars | Race conditions in concurrent requests, untestable | All state via IoC request-scoped containers; no module-level mutation |
| Hardcoded Infrastructure | `new Redis()`, `new PgPool()` inline | Untestable, not swappable, env-specific | All infrastructure via interfaces + IoC; `new` only inside ServiceProviders |
| Catch-and-Ignore | `catch(e) {}` | Silent failures, debugging nightmares | `Result<T,E>` type enforced; all errors typed and propagated |
| Stringly-Typed Events | `emit('user:registered', data)` | No type safety on payload; typos at runtime | Typed event classes: `new UserRegistered(user)` |
| Implicit Transactions | Forgetting `DB.transaction()` | Data integrity violations on partial writes | `DB.transaction()` wraps related ops; linting rule warns on multi-write without tx |
| Synchronous I/O in Request Path | `fs.readFileSync()` in middleware | Blocks event loop under load | All I/O async; ESLint rule bans sync I/O in request handlers |
| Prototype Pollution | `Object.assign({}, userInput)` | Remote code execution vector | `Object.create(null)` for merge base; deep clone uses structuredClone |
| Timing-Unsafe Comparison | `storedHash === providedHash` | Auth bypass via timing attack | All credential comparison uses `crypto.timingSafeEqual` |

---

## 2. Web Ecosystem SWOT Analysis

### 2.1 Opportunities — Carpenter Must Capitalize On

| # | Opportunity | Current Gap | Carpenter Implementation |
|---|-------------|-------------|--------------------------|
| O1 | **Edge Computing** | Most frameworks bolt on edge support as afterthought | First-class `IEdgeRuntime` adapter; auto-detects CF Workers, Vercel Edge, Deno Deploy |
| O2 | **Bun's native speed** | Express/Node throughput ceiling well-known | HTTP layer on `Bun.serve`; connection handling 10x faster than Express; Node fallback preserved |
| O3 | **TypeScript maturity** | Many frameworks treat TS as afterthought; leaky `any` everywhere | Strict TypeScript throughout; no `any`; generics on all APIs; generated types from ORM/GraphQL |
| O4 | **Web Standards convergence** | Frameworks diverge from native Fetch/Request/Response | `Request`/`Response` are Web Standard objects; code portable to browser/edge/server |
| O5 | **AI/LLM Integration** | No full-stack framework has first-class AI primitives | `@carpentry/ai` — streaming, agents, RAG pipelines, tool calling, MCP client/server |
| O6 | **WASM modules** | Ignored by all major web frameworks | `@carpentry/wasm` — load and call WASM modules (Rust/C/C++/Go) directly in app |
| O7 | **Polyglot microservices** | Painful, boilerplate-heavy integration with non-JS services | `@carpentry/bridge` — gRPC, NATS, Kafka, Unix socket; code-gen from .proto / CSDL |
| O8 | **Islands Architecture** | Only Astro does this well | CarpenterUI Islands: static HTML shell + hydrate only interactive components |
| O9 | **HTTP/3 and QUIC** | Almost no framework supports it out of the box | HTTP/3 via Bun's native QUIC; automatic protocol negotiation |
| O10 | **Streaming everywhere** | Streaming SSR rare; streaming API responses rarer | `Response.stream()`, streaming AI responses, streaming ORM cursors — all first-class |
| O11 | **SQLite renaissance** | Treated as "just testing" DB | SQLite as production-grade with Litestream/Turso/libSQL adapters built in |
| O12 | **Developer AI assistance** | Frameworks not designed for AI-assisted development | Typed APIs + JSDoc + this spec = perfect AI codegen surface area |
| O13 | **Fine-grained reactivity** | React VDOM thrash; Vue proxy overhead | Signals (Solid-inspired) in CarpenterUI — surgical DOM updates, zero unnecessary re-renders |
| O14 | **Container-native deployment** | Frameworks ignore Kubernetes lifecycle | Health `/healthz`, `/readyz` endpoints; graceful shutdown; resource limit awareness built-in |
| O15 | **Multi-tenancy** | Bolted-on in every SaaS app separately | First-class multi-tenancy: tenant-scoped DB/cache/storage; multiple isolation strategies |
| O16 | **Feature flags** | External-service-only (LaunchDarkly), no framework integration | `@carpentry/flags` — local, database, and LaunchDarkly/Unleash-backed feature flags |
| O17 | **Real-time collaboration** | CRDTs and OT not accessible to web framework users | `@carpentry/crdt` — Yjs-backed collaborative primitives with persistence adapters |
| O18 | **OpenTelemetry** | Manual instrumentation, per-framework plugins | Auto-instrumented: every DB query, cache op, queue job, HTTP request, AI call — zero boilerplate |

### 2.2 Threats — Carpenter Must Guard Against

| # | Threat | How It Manifests | Carpenter Defence |
|---|--------|-----------------|------------------|
| T1 | **Supply chain attacks** | Malicious npm packages, typosquatting, dependency confusion | Minimal dependencies policy (< 15 direct); lockfile integrity in CI; `npm audit` gate; allowlist policy |
| T2 | **Dependency breaking changes** | Semver violations, deprecated APIs | All external packages behind internal adapter interfaces; never exposed directly to app code |
| T3 | **TypeScript breaking changes** | TS 6.x changes decorator semantics, strict mode tightening | Decorator logic isolated in `@carpentry/container`; upgrade CI matrix tests TS N and N+1 |
| T4 | **Bun API instability** | Bun 2.x changes `Bun.serve` / `Bun.sqlite` APIs | `IHttpServer` abstraction; Bun adapter swappable for Node/Hono; CI tests both runtimes |
| T5 | **Memory leaks** | Event listener accumulation, unclosed DB connections, circular refs | `IDisposable` pattern; scope destroy = release resources; leak detector in dev mode; heap snapshot command |
| T6 | **Race conditions** | Concurrent requests mutating shared state | Request-scoped containers; immutable request objects; `AsyncLocalStorage` for context; no module-level mutation |
| T7 | **SQL injection** | User input interpolated into queries | QueryBuilder always parameterized; `raw()` method renamed `dangerouslyRaw()` requiring explicit opt-in comment |
| T8 | **SSRF** | Server fetching attacker-controlled URLs | `HttpClient` with SSRF protection: private IP range blocklist, URL allowlist mode, timeout enforcement |
| T9 | **ReDoS** | Complex regex in validation rules hang process | Validation rules use linear-time algorithms; user-supplied regex validated with RE2 engine |
| T10 | **Prototype pollution** | `JSON.parse` + `Object.assign` of untrusted input | Deep merge uses `Object.create(null)`; prototype chain checks in config/env loader |
| T11 | **Timing attacks** | Non-constant-time string comparison in auth | All credential/token comparison uses `crypto.timingSafeEqual` — enforced by linting rule |
| T12 | **Peer dependency conflicts** | Monorepo packages with mismatched peer deps | Single version policy via `syncpack`; peer deps declared strictly; Turborepo enforces graph |
| T13 | **Vendor lock-in** | Direct use of AWS SDK / CloudFlare SDK in app code | Cloud vendor SDKs in adapter packages only; app code sees only `IStorageAdapter`, `ICacheStore` etc. |
| T14 | **AI hallucination in generated code** | AI produces structurally wrong framework code | Type system + failing tests catch hallucinations; JSDoc contracts act as AI guardrails |
| T15 | **Open redirect** | `redirect(userInput)` without validation | `Response.redirect()` validates against allowlist; `Response.externalRedirect()` explicit opt-in only |
| T16 | **Log injection** | Attacker injects newlines into log messages | Logger sanitizes all string values; structured JSON logs not line-parseable |
| T17 | **Deserialization attacks** | `eval()`, `Function()`, unsafe YAML | Banned by ESLint: no `eval`, no `Function()`, no `js-yaml.load` without safe schema |
| T18 | **Session fixation** | Session ID not rotated on privilege escalation | `session.regenerate()` called automatically on login by `SessionGuard` |
| T19 | **Clickjacking** | Missing X-Frame-Options / CSP frame ancestors | `SecureHeaders` middleware sets both; CSP configured per-route for embed use cases |
| T20 | **Enumeration attacks** | Different error for valid vs invalid username | Auth errors always return same message; same response time via artificial delay |

---

## 3. New Epics

| Epic ID | Name | Sprints |
|---------|------|---------|
| E21 | Polyglot Microservices Bridge | 21–22 |
| E22 | Edge Computing Runtime | 23 |
| E23 | AI/LLM Integration Layer | 24–25 |
| E24 | GraphQL Support | 26 |
| E25 | Observability & OpenTelemetry | 27 |
| E26 | Multi-tenancy System | 28 |
| E27 | CarpenterAdmin Panel | 29 |
| E28 | WASM Module Integration | 30 |
| E29 | Advanced Security Hardening | 30 |
| E30 | Feature Flags & Experimentation | 31 |
| E31 | Real-time Collaboration Primitives | 32 |
| E32 | Developer Experience & DX Tooling | 33 |
| E33 | HTTP/3, WebTransport & Streaming | 34 |
| E34 | ISR, Islands Architecture & Partial Hydration | 34 |
| E35 | Performance Benchmarks, Stress Tests & SLA Specs | 35 |
| E36 | Broadcasting System | 18 (partial) |
| E37 | Search System | 41 |
| E38 | Audit & Webhooks | 41 |
| E39 | Health & Encryption | 41 |
| E40 | Extended Adapters (Turso, SQS, GCS, Azure, Memcached) | 41 |
| E41 | Islands UI Ecosystem (Framework adapters, charts, icons) | 42 |

---

## 4. Sprints 21–40

---

### Sprint 21 — Polyglot Microservices: Transport Layer (E21 partial)

**Sprint Goal:** Transport-agnostic microservices bridge — call Rust, Go, Python, or Java services as if they were local TypeScript classes.

---

**CARP-068** `[E21]` Microservices Bridge — Core Contracts & TypedServiceProxy  
**Points:** 8 | **Priority:** Critical

```
As a developer,
I want to call a service written in Rust, Go, or Python
As if it were a local TypeScript class injected by the IoC container,
So that polyglot microservices are a first-class, type-safe citizen.

Design Philosophy:
- Transport layer is COMPLETELY SEPARATE from the service API definition
- Developer declares a typed TypeScript interface; Carpenter handles all serialization
- Same interface works whether the service is in-process, gRPC, NATS, or HTTP
- Service discovery is pluggable (env, Consul, k8s DNS, etcd, static)
- Failure handling: circuit breaker + retry automatically wraps every call

Core Interfaces:
  interface IRemoteService {
    call<TReq, TRes>(method: string, payload: TReq, opts?: CallOptions): Promise<TRes>
    stream<TReq, TRes>(method: string, payload: TReq): AsyncIterable<TRes>
    notify<TReq>(method: string, payload: TReq): Promise<void>  // fire-and-forget
  }

  interface ITransportAdapter {
    connect(endpoint: ServiceEndpoint): Promise<void>
    disconnect(): Promise<void>
    send<TReq, TRes>(message: TransportMessage<TReq>): Promise<TRes>
    subscribe(subject: string, handler: MessageHandler): Unsubscribe
  }

  class MicroserviceManager {
    register(name: string, transport: ITransportAdapter, discovery?: IServiceDiscovery): void
    resolve<T>(serviceName: string): TypedServiceProxy<T>  // ES Proxy pattern
  }

// Developer usage — this call could be hitting a Rust binary over gRPC:
const timetable = app.service<ITimetableService>('timetable')
const schedule = await timetable.generateSchedule({ term: 'Spring2025' })

Acceptance Criteria:
- [ ] ITransportAdapter interface defined and documented
- [ ] MicroserviceManager singleton in IoC container
- [ ] TypedServiceProxy: ES Proxy intercepts method calls → ITransportAdapter.call()
- [ ] CallOptions: timeout, retries, traceContext, headers
- [ ] Remote errors mapped to RemoteServiceError (typed, with code + message from remote)
- [ ] Circuit breaker auto-wrapped: opens after threshold, logged and monitored
- [ ] W3C TraceContext propagated in every transport call (Observability integration)
- [ ] Retry with exponential backoff on transient failures
- [ ] MockTransportAdapter: records calls, returns configured responses
- [ ] Full unit tests with MockTransportAdapter
```

---

**CARP-069** `[E21]` gRPC Transport Adapter (@carpentry/bridge-grpc)  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- Wraps @grpc/grpc-js with Carpenter ITransportAdapter interface
- carpenter generate:grpc-client path/to/service.proto
  → Generates ITimetableService TypeScript interface from .proto service definition
  → Generates GrpcTransportAdapter implementation bound to that service
- Streaming: server-streaming returns AsyncIterable<T>, client-streaming, bidirectional
- Interceptors: auth token injection, deadline propagation, trace header injection
- TLS modes: insecure (dev), server-side TLS, mutual TLS
- gRPC health check protocol: grpc.health.v1.Health/Check

Code generation example — from this .proto:
  service TimetableService {
    rpc GenerateSchedule(GenerateRequest) returns (ScheduleResult);
    rpc WatchSchedule(WatchRequest) returns (stream ScheduleEvent);
  }
→ generates:
  interface ITimetableService {
    generateSchedule(req: GenerateRequest): Promise<ScheduleResult>
    watchSchedule(req: WatchRequest): AsyncIterable<ScheduleEvent>
  }

Acceptance Criteria:
- [ ] GrpcTransportAdapter implements ITransportAdapter
- [ ] carpenter generate:grpc-client produces compilable TypeScript
- [ ] Unary calls: correct timeout propagation, error mapping
- [ ] Server-streaming: AsyncIterable<T> that cancels gRPC call on break
- [ ] Client-streaming: iterable input, awaited single response
- [ ] Bidirectional streaming: AsyncIterable in both directions
- [ ] TLS: all three modes configured and tested
- [ ] gRPC metadata carries W3C trace context headers
- [ ] Integration test: Carpenter → mock gRPC server (in-process, no network)
- [ ] Unit tests with mocked gRPC channel
```

---

**CARP-070** `[E21]` NATS & Kafka Transport Adapters  
**Points:** 8 | **Priority:** High

```
@carpentry/bridge-nats:
- NATS request/reply (synchronous RPC pattern over pub/sub)
- NATS publish (fire-and-forget notify)
- NATS subscribe (long-lived — for server-push patterns)
- JetStream: persistent streams, consumer groups, replay
- Queue groups: N instances of same service, load-balanced by NATS

@carpentry/bridge-kafka:
- Kafka producer: send(topic, key, value, headers)
- Kafka consumer: subscribe(topics, groupId, handler) — auto-commit or manual
- Exactly-once semantics: transactional producer option
- Schema Registry integration: Avro/Protobuf/JSON Schema validation on produce + consume
- Seek: consumer.seek(partition, offset) for replay

Both adapters:
- Propagate W3C TraceContext in message headers
- Respect ITransportAdapter interface fully (LSP compliance)
- Graceful shutdown: NATS drains before disconnect, Kafka commits offsets

Acceptance Criteria:
- [ ] NATS adapter: request/reply, publish, subscribe all working
- [ ] Kafka adapter: produce, consume, seek working
- [ ] NATS JetStream: persistent messages, consumer offsets
- [ ] Kafka schema validation: invalid messages rejected on produce, logged
- [ ] Graceful shutdown verified by test (no in-flight message loss)
- [ ] Integration tests with embedded NATS server and Kafka (Testcontainers)
- [ ] Unit tests with mock NATS/Kafka clients
```

---

**Sprint 21 Total: 24 points**

---

### Sprint 22 — Polyglot Microservices: CSDL, Discovery, Unix Sockets & Rust Example (E21 complete)

---

**CARP-071** `[E21]` Carpenter Service Definition Language (CSDL) & Code Generation  
**Points:** 8 | **Priority:** Critical

```
As a developer,
I want to define a service contract ONCE in a schema file
And generate TypeScript clients AND server stubs in any target language,
So that polyglot services are always in sync with zero manual type duplication.

Technical Spec:
CSDL format (carpenter.service.yaml):
  name: timetable-service
  version: 1.0.0
  transport: grpc         # grpc | nats | kafka | http | unix-socket
  methods:
    generateSchedule:
      input: GenerateScheduleRequest
      output: ScheduleResult
      streaming: false
    watchSchedule:
      input: WatchRequest
      output: ScheduleEvent
      streaming: server   # none | server | client | bidirectional
  models:
    GenerateScheduleRequest:
      properties:
        term: string
        constraints: Constraint[]
    ScheduleResult:
      properties:
        sessions: Session[]
        conflicts: Conflict[]

CLI commands:
  carpenter generate:client timetable.service.yaml --lang=typescript
    → src/services/TimetableService.ts (typed interface + transport proxy factory)

  carpenter generate:server timetable.service.yaml --lang=rust
    → Rust trait + Cargo.toml boilerplate + main.rs gRPC server scaffold

  carpenter generate:server timetable.service.yaml --lang=go
    → Go interface + main.go gRPC server scaffold

  carpenter generate:server timetable.service.yaml --lang=python
    → Python abstract base class + asyncio gRPC server scaffold

  carpenter generate:server timetable.service.yaml --lang=dotnet
    → C# interface + ASP.NET gRPC server scaffold

Schema Evolution Rules (enforced in CI):
  - Adding optional fields: non-breaking ✅
  - Removing fields: breaking ❌ — must use deprecation cycle
  - Changing types: breaking ❌
  - carpenter service:check --base=v1.0.0 --head=v1.1.0 (CI gate)

Acceptance Criteria:
- [ ] CSDL schema parsed and validated with helpful error messages
- [ ] TypeScript client: typed interface + ITransportAdapter-wrapped Proxy factory
- [ ] Rust server stub: trait definition, Cargo.toml, main.rs scaffold
- [ ] Go server stub: interface + server scaffold
- [ ] Python server stub: abstract class + asyncio gRPC scaffold
- [ ] Generated TypeScript compiles with zero errors under strict mode
- [ ] Breaking change detection: carpenter service:check fails CI on breaking changes
- [ ] Version header in every call: client version + server version for mismatch detection
- [ ] Full tests: generated TypeScript integrates with MockTransportAdapter
```

---

**CARP-072** `[E21]` Service Discovery & Health Monitoring  
**Points:** 5 | **Priority:** High

```
Technical Spec:
IServiceDiscovery: resolve(name): Promise<ServiceEndpoint[]>

Discovery Adapters:
  EnvVar:  CARPENTER_SERVICE_TIMETABLE_URL=grpc://localhost:50051
  Static:  config/services.ts → { timetable: { url: '...', transport: 'grpc' } }
  DNS:     timetable.default.svc.cluster.local:50051 (Kubernetes)
  Consul:  consul.resolve('timetable') → healthy instances
  Eureka:  Netflix Eureka registry

Health Monitoring:
  - Periodic health check per registered service (configurable interval)
  - gRPC services: grpc.health.v1.Health/Check
  - HTTP services: GET /health or configured path
  - NATS/Kafka: ping/heartbeat subjects
  - Auto-remove unhealthy endpoints from rotation
  - Circuit breaker opens on repeated failures

Load Balancing (Strategy pattern):
  RoundRobin | LeastConnections | Random | IpHash | WeightedRoundRobin

Acceptance Criteria:
- [ ] All discovery adapters implement IServiceDiscovery
- [ ] EnvVar discovery: CARPENTER_SERVICE_{NAME}_URL pattern
- [ ] DNS discovery resolves k8s short service names
- [ ] Health check interval and failure threshold configurable
- [ ] Unhealthy endpoints removed; restored after recovery check
- [ ] Load balancer distributes across healthy endpoints only
- [ ] ServiceRegistry events: service-up, service-down, service-degraded
- [ ] Full unit tests with MockDiscovery
```

---

**CARP-073** `[E21]` Unix Socket & High-Performance Local Transport  
**Points:** 5 | **Priority:** Medium

```
Use Case: Co-located services (same host/pod) — e.g., Rust image processing sidecar

Technical Spec:
- UnixSocketTransportAdapter: IPC via Unix domain sockets
- Protocol: MessagePack framing (length-prefixed, compact binary)
- SharedMemoryTransport (advanced): mmap + eventfd for ultra-low latency
- Auto-fallback: if socket path unavailable → localhost TCP fallback
- carpet benchmark:transport — runs latency/throughput test against any transport

Performance targets:
  Unix socket round-trip: < 100μs p99 on same host
  Shared memory round-trip: < 10μs p99 on same host

Acceptance Criteria:
- [ ] Unix socket adapter: connect, send, receive, disconnect
- [ ] MessagePack serialization for all transport messages
- [ ] Auto-fallback to TCP on socket path unavailable
- [ ] Benchmark command: reports p50, p95, p99, p999 latency + throughput
- [ ] Integration test: Carpenter ↔ mock Unix socket server (in-process pipe)
```

---

**CARP-074** `[E21]` Complete Polyglot Example: Carpenter App + Rust Timetable Service  
**Points:** 5 | **Priority:** High

```
Deliverable: A complete, docker-compose-runnable reference example.

examples/polyglot-timetable/
├── carpenter-app/              # Carpenter fullstack app
│   ├── routes/web.ts           # Routes: POST /schedule, GET /schedule/:id
│   ├── services/               # ITimetableService (generated from CSDL)
│   ├── pages/Schedule.carp     # CarpenterUI page showing generated schedule
│   └── tests/                  # Full test suite using MockTransportAdapter
├── timetable-rust/             # The Rust gRPC service
│   ├── src/main.rs             # ITimetableService impl (generated scaffold, filled in)
│   ├── Cargo.toml
│   └── proto/timetable.proto   # Shared proto (source of truth → CSDL generated from this)
├── timetable-go/               # Same service in Go (demonstrates swap)
│   ├── main.go
│   └── go.mod
└── docker-compose.yml          # Starts: postgres + carpenter-app + timetable-rust

README covers:
  1. How to add your own Rust/Go/Python service to a Carpenter app
  2. How to switch transports (gRPC → NATS) with one config change
  3. How to write tests for code that calls remote services

Acceptance Criteria:
- [ ] docker-compose up starts all services successfully
- [ ] Carpenter app calls Rust service over gRPC
- [ ] Streaming: real-time schedule updates via server-streaming WebSocket bridge
- [ ] Swapping Rust service for Go service requires ZERO application code changes
- [ ] Full test suite for Carpenter app using MockTransportAdapter (no Rust needed for tests)
- [ ] README is accurate and complete
```

---

**Sprint 22 Total: 23 points**

---

### Sprint 23 — Edge Computing Runtime (E22)

**Sprint Goal:** Carpenter deploys to Cloudflare Workers, Vercel Edge, Deno Deploy, and Fastly with zero application code changes.

---

**CARP-075** `[E22]` Edge Runtime Abstraction & Auto-Detection  
**Points:** 8 | **Priority:** High

```
Design Principle: The adapter pattern already insulates app code from infrastructure.
Edge runtime just means DIFFERENT ADAPTERS — not different application code.

Technical Spec:
IEdgeRuntime: {
  name: 'bun' | 'node' | 'cloudflare' | 'vercel-edge' | 'deno' | 'fastly'
  capabilities: EdgeCapabilities   // what this runtime supports
}

EdgeBootstrap (runs before ApplicationBootstrap on edge):
  1. Detect runtime from globalThis signatures
  2. Select edge-compatible adapter set for this runtime
  3. Register adapters in IoC container (overriding defaults)
  4. Boot application normally

Edge-compatible adapter implementations:
  EdgeCacheStore        → CF KV / Vercel KV / Deno KV
  EdgeSessionStore      → Stateless JWT cookies (no server-side session state)
  EdgeStorageAdapter    → CF R2 / Vercel Blob / S3 (HTTP API, no SDK binary)
  EdgeDatabaseAdapter   → CF D1 / PlanetScale HTTP / Neon serverless HTTP
  EdgeQueueAdapter      → CF Queues / Vercel Edge Config
  EdgeMailAdapter       → Resend / Mailgun (HTTP API only, no SMTP)

Build targets:
  carpenter build --target=cloudflare   → dist/worker.js (ESM, no Node APIs)
  carpenter build --target=vercel-edge  → .vercel/output/functions/
  carpenter build --target=deno         → dist/deno.ts
  carpenter build --target=bun          → dist/server.ts (default)
  carpenter build --target=node         → dist/server.cjs

Edge Constraints (handled gracefully):
  - No filesystem          → FileSessionStore/FileCache throw EdgeIncompatibleError with suggestion
  - CPU time limits        → Request streaming, no blocking compute
  - No long-running proc   → Queue worker replaced by edge queue trigger pattern
  - Bundle size limits     → Tree-shaking ensures only used adapters in bundle

Acceptance Criteria:
- [ ] Runtime auto-detected at boot from globalThis.caches, Bun, Deno globals
- [ ] EdgeBootstrap selects correct adapters per detected runtime
- [ ] CF Workers build passes wrangler publish --dry-run
- [ ] Vercel Edge build deploys via vercel --prebuilt
- [ ] CF D1 adapter: full QueryBuilder support over D1 HTTP API
- [ ] CF KV cache: get/put/delete/list with TTL
- [ ] Stateless JWT session: signs/verifies with APP_KEY, stored in cookie
- [ ] Edge-incompatible features degrade with clear, actionable error messages
- [ ] Tests: EdgeBootstrap adapter selection per mocked runtime
```

---

**CARP-076** `[E22]` ISR, Tag-Based Cache Invalidation & CDN-Aware Responses  
**Points:** 5 | **Priority:** Medium

```
Technical Spec:
- Response.static(page, props, { revalidate: 60 }): ISR — stale-while-revalidate
- Response.static(page, props, { tags: ['posts', 'post:42'] }): tag-based
- carpenter.revalidate(tag): on-demand invalidation (webhook endpoint)
- Cache-Control: s-maxage=60, stale-while-revalidate=86400
- Surrogate-Control / CDN-Cache-Control for CDN-specific behaviour
- SSG: carpenter build --ssg crawls all static routes, saves HTML
- ISR on CF: backed by CF Cache API + KV for tag index
- ISR on self-hosted: backed by Redis tag index

Acceptance Criteria:
- [ ] Response.static() emits correct cache headers
- [ ] Stale-while-revalidate: serves stale content, regenerates in background
- [ ] On-demand revalidation secured with CARPENTER_REVALIDATION_SECRET header
- [ ] Tag invalidation: purges ALL pages tagged with given tag atomically
- [ ] SSG generates static HTML for all routes with no dynamic params
- [ ] Full tests with mock cache store
```

---

**CARP-077** `[E22]` Edge Middleware: Geo-Routing, A/B Testing, Bot Detection  
**Points:** 3 | **Priority:** Medium

```
Technical Spec:
- request.geo(): { country, region, city, latitude, longitude, timezone }
  → populated from CF-IPCountry, x-vercel-ip-country, or MaxMind lite DB
- GeoMiddleware: redirect or serve locale-specific page based on country
- A/B TestMiddleware: consistent bucketing via hashed userId/cookie; no origin hit for cached variants
- BotMiddleware: CF Bot Management header or User-Agent heuristic
- carpenter make:middleware --edge: generates edge-compatible middleware (warns against filesystem use)

Acceptance Criteria:
- [ ] request.geo() returns populated object from CF/Vercel headers
- [ ] GeoMiddleware: country-based redirect configurable in routes/web.ts
- [ ] A/B: consistent bucket via SHA256(userId + experimentKey) % 100
- [ ] Bot detection: blocks or serves alternate content for known bots
- [ ] Edge middleware generates warning if it imports Node-only modules
- [ ] Full tests with mock geo headers
```

---

**Sprint 23 Total: 16 points**

---

### Sprint 24 — AI/LLM Integration: Core Provider, Streaming & RAG (E23 partial)

---

**CARP-078** `[E23]` AI Provider Abstraction & Facade  
**Points:** 8 | **Priority:** High

```
Technical Spec:
interface IAIProvider {
  complete(opts: CompletionOptions): Promise<CompletionResult>
  stream(opts: CompletionOptions): AsyncIterable<CompletionChunk>
  embed(texts: string[], model?: string): Promise<number[][]>
  moderate(text: string): Promise<ModerationResult>
  countTokens(text: string, model: string): number
}

Providers: OpenAI, Anthropic, Groq, Mistral, Azure OpenAI, Ollama (local)

AI Facade (mirrors Laravel facade pattern):
  AI.complete({ model: 'claude-opus-4-5', messages: [...] })
  AI.stream({ ... })           → AsyncIterable<string>
  AI.embed(['text1', 'text2']) → number[][]
  AI.structured<T>(schema, prompt) → T  (uses JSON mode / tool use)
  AI.guard('anthropic').complete(...)   → explicit provider

Structured Output (AI.structured<T>):
  1. Generates JSON Schema from Zod schema
  2. Calls provider with JSON mode or function-calling
  3. Validates response against schema
  4. Retries up to 3x on invalid JSON/schema mismatch
  5. Returns typed T on success

Tool/Function Calling:
  AI.withTools([SearchTool, CalendarTool]).complete(opts)
  → Returns ToolCallResult[] or TextResult
  → auto-executes tools, feeds results back to model (agentic loop)

Fallback chain:
  AI.withFallback(['anthropic', 'openai']).complete(opts)
  → Falls back to openai if anthropic throws or times out

AI.fake(): swaps all providers with MockAIProvider for testing

Acceptance Criteria:
- [ ] IAIProvider implemented for: OpenAI, Anthropic, Groq, Ollama
- [ ] AI.complete() returns CompletionResult with { text, usage, finishReason }
- [ ] AI.stream() returns AsyncIterable<string> (text delta chunks)
- [ ] AI.structured<T>() validates against Zod schema; retries on invalid
- [ ] Tool calling: tools declared, auto-executed, results returned to model
- [ ] Fallback chain: secondary provider tried on primary failure
- [ ] AI.fake() + MockAIProvider for deterministic tests
- [ ] Rate limiting: token-bucket per provider; respects provider-reported limits
- [ ] AI call auditing: every call logged with model, tokens, latency, cost estimate
- [ ] Full unit tests with MockAIProvider
```

---

**CARP-079** `[E23]` Streaming AI Responses & useStream() Composable  
**Points:** 5 | **Priority:** High

```
Technical Spec:
Server:
  // Controller:
  async generate(request: Request): Promise<Response> {
    this.authorize('use-ai', request.user())
    const stream = AI.stream({ messages: [{ role: 'user', content: request.input('prompt') }] })
    return Response.aiStream(stream)
  }

Response.aiStream(iterable):
  - Content-Type: text/event-stream
  - SSE protocol: data: {chunk}\n\n
  - Last event: data: [DONE]\n\n
  - Abort: listens for client disconnect; cancels provider request via AbortController
  - Error events: data: {"error": "..."}\n\n

Client (CarpenterUI):
  const { text, loading, error, abort } = useStream('/ai/generate', { prompt })
  // text is a reactive signal, appends chunk by chunk

React adapter:
  const { text, loading, error, abort } = useStream('/ai/generate', { prompt })
  // text is state, re-renders per chunk

Acceptance Criteria:
- [ ] SSE format correct: data: prefix, double newline, [DONE] terminator
- [ ] Client disconnect cancels upstream AI request (no wasted tokens)
- [ ] useStream() composable: text signal updates per chunk, loading/error states
- [ ] React useStream() hook with identical API
- [ ] AiRateLimitMiddleware: tokens/minute per user configurable
- [ ] TTFB < 200ms (time to first token/chunk)
- [ ] Full integration test: mock AI provider streams to test SSE client
```

---

**CARP-080** `[E23]` Vector Embeddings, RAG Pipeline & Document Loaders  
**Points:** 8 | **Priority:** High

```
Technical Spec:
IVectorStore:
  upsert(id: string, vector: number[], metadata: object): Promise<void>
  query(vector: number[], topK: number, filter?: object): Promise<ScoredDocument[]>
  delete(ids: string[]): Promise<void>

Adapters: pgvector (Postgres), Pinecone, Qdrant, ChromaDB, Weaviate, InMemory

RAG Ingestion Pipeline (Builder pattern):
  await RAG.pipeline()
    .load(new PdfLoader('docs/manual.pdf'))
    .load(new UrlLoader('https://docs.example.com'))
    .load(new DatabaseLoader(Article.published()))   // ORM model as doc source
    .chunk(new RecursiveCharacterSplitter({ size: 500, overlap: 50 }))
    .embed(AI.embedder('text-embedding-3-small'))
    .store(app.make(IVectorStore))
    .run()

RAG Query Pipeline:
  const answer = await RAG.query()
    .embed(question, AI.embedder())
    .retrieve(vectorStore, { topK: 5 })
    .rerank(new CrossEncoderReranker())    // optional
    .augment(systemPrompt)
    .complete(AI)                          // or .stream(AI)

Document Loaders:
  PdfLoader, UrlLoader, DatabaseLoader, DirectoryLoader, GitLoader, YouTubeLoader

Chunking Strategies:
  FixedSizeChunker, RecursiveCharacterSplitter, SemanticChunker, SentenceChunker

Acceptance Criteria:
- [ ] IVectorStore implemented for pgvector and InMemory
- [ ] Pinecone adapter: upsert, query with metadata filters
- [ ] Qdrant adapter: collections, payload filtering, named vectors
- [ ] RAG ingestion pipeline: loads, chunks, embeds, stores in sequence
- [ ] PdfLoader extracts text from multi-page PDFs
- [ ] UrlLoader: fetches, strips HTML noise (Readability algorithm)
- [ ] DatabaseLoader: ORM model records as document source with metadata
- [ ] RAG query pipeline returns typed, scored, ranked documents
- [ ] CrossEncoderReranker improves relevance ordering
- [ ] InMemory vector store for unit tests (cosine similarity, no external service)
- [ ] Full tests with MockAIProvider and InMemory vector store
```

---

**Sprint 24 Total: 21 points**

---

### Sprint 25 — AI Agents, MCP Integration & AI Guard Middleware (E23 complete)

---

**CARP-081** `[E23]` AI Agent Framework  
**Points:** 13 | **Priority:** High

```
Technical Spec:
class Agent {
  constructor(
    private readonly ai: IAIProvider,
    private readonly tools: ITool[],
    private readonly memory: IAgentMemory,
    private readonly options: AgentOptions
  ) {}

  async run(input: string): Promise<AgentResult>
  stream(input: string): AsyncIterable<AgentEvent>
}

// Tool declaration via decorator:
@AiTool({
  name: 'query-database',
  description: 'Query user records from the database',
  schema: z.object({ filter: z.string(), limit: z.number().default(10) })
})
async queryDatabase(input: QueryDatabaseInput, ctx: AgentContext): Promise<User[]> {
  return User.where('name', 'like', `%${input.filter}%`).limit(input.limit).get()
}

ReAct Loop (Reasoning + Acting):
  1. LLM receives input + available tool schemas
  2. LLM decides: respond directly OR call tool(s)
  3. Tool(s) executed (parallel if multiple)
  4. Results fed back to LLM
  5. Repeat until LLM responds directly or maxSteps reached

Agent Memory:
  ShortTermMemory:  conversation history, auto-summarized when > maxTokens
  LongTermMemory:   vector store — retrieve relevant past context per query
  WorkingMemory:    scratchpad for current task (cleared per run)

AgentEvents (stream mode):
  { type: 'thinking', content: '...' }
  { type: 'tool_call', tool: 'query-database', input: {...} }
  { type: 'tool_result', tool: 'query-database', result: {...} }
  { type: 'response', content: '...' }
  { type: 'error', message: '...' }

Human-in-the-loop:
  agent.requireApproval('delete-record')  // pauses and emits approval_required event
  await agent.approve('delete-record')    // resumes
  await agent.reject('delete-record', 'Not authorized')  // sends rejection to LLM

carpenter make:agent generates Agent class stub

Acceptance Criteria:
- [ ] @AiTool() registers tool with Zod schema, validates input before execution
- [ ] ReAct loop runs until finalResponse or maxSteps (default: 10)
- [ ] Parallel tool calls: multiple tools called concurrently (Promise.allSettled)
- [ ] Short-term memory: history managed, summarized when token limit approached
- [ ] Long-term memory: relevant past context retrieved via vector similarity
- [ ] Human approval: run pauses, emits event, resumes/rejects on signal
- [ ] Stream mode: all agent events streamed as SSE
- [ ] Agent observability: every tool call logged with input/output/duration (OTel span)
- [ ] carpenter make:agent generates typed Agent stub
- [ ] Full tests with MockAIProvider simulating multi-step, multi-tool scenarios
```

---

**CARP-082** `[E23]` MCP Client/Server & AI Guard Middleware  
**Points:** 8 | **Priority:** Medium

```
MCP Client (@carpentry/mcp-client):
  - Connects to any MCP server (stdio transport or HTTP/SSE)
  - Discovers tools, resources, and prompts from server
  - Makes them available to Agents as ITool implementations
  - carpenter.mcp.ts: list MCP servers to connect on boot

  config example:
    mcp_servers:
      - name: filesystem
        command: npx @modelcontextprotocol/server-filesystem /workspace
      - name: github
        url: https://mcp.github.com/sse
        auth: Bearer ${GITHUB_TOKEN}

MCP Server (@carpentry/mcp-server):
  - Exposes Carpenter routes/services as MCP tools
  - @McpTool() decorator on service methods
  - Carpenter app becomes an MCP server any AI can connect to

AiGuardMiddleware:
  - PII detection: flags/blocks responses containing email, phone, SSN patterns
  - Toxicity filter: optional moderation API call on output
  - Output length limit: prevents runaway responses
  - Prompt injection detection: scans user input for injection signatures
  - All filters configurable and composable

AI Audit Log:
  - AsyncLocalStorage captures all AI interactions per request
  - Stored: model, provider, prompt hash, response hash, token counts, latency, cost
  - Query: AuditLog.where('user_id', user.id).where('model', 'claude').get()

Acceptance Criteria:
- [ ] MCPClient connects to filesystem MCP server via stdio
- [ ] MCPClient discovers tools and makes them callable as ITool
- [ ] Carpenter MCP server exposes @McpTool methods
- [ ] AiGuardMiddleware: PII detection blocks/redacts before response sent
- [ ] Prompt injection: known patterns detected and request rejected with  403
- [ ] Audit log records all AI calls with model/tokens/cost/latency
- [ ] Full tests with MockAIProvider and MockMCPServer
```

---

**Sprint 25 Total: 21 points**

---

### Sprint 26 — GraphQL: Schema, Resolvers, DataLoader & Federation (E24)

---

**CARP-083** `[E24]` GraphQL Core — Code-First & Schema-First  
**Points:** 8 | **Priority:** High

```
Technical Spec (@carpentry/graphql):
Code-first (primary):
  @ObjectType() class Post {
    @Field(() => ID)   id: string
    @Field()           title: string
    @Field(() => User) author: User
    @Field({ nullable: true }) publishedAt?: Date
  }

  @Resolver(Post)
  class PostResolver {
    constructor(@Inject(IPostRepository) private posts: IPostRepository) {}

    @Query(() => [Post])
    async posts(@Arg('filter', { nullable: true }) filter?: PostFilter): Promise<Post[]>

    @Mutation(() => Post)
    @UseMiddleware(AuthMiddleware)
    async createPost(@Arg('input') input: CreatePostInput, @Ctx() ctx: GqlContext): Promise<Post>

    @FieldResolver(() => User)
    @UseDataLoader(UserDataLoader)  // auto-batches N field resolver calls → 1 DB query
    async author(@Root() post: Post, @DataLoader() loader: UserDataLoader): Promise<User>

    @Subscription(() => Post, { topics: ({ args }) => `POST_CREATED_${args.authorId}` })
    newPost(@Root() payload: Post): Post { return payload }
  }

Schema-first (alternate): typeDefs from .graphql files, separate resolver map

Features:
  - DataLoader: auto-batching for every @FieldResolver (N+1 prevention)
  - Subscriptions: graphql-ws protocol over WebSocket
  - Context: { request, user, container, dataloaders } per operation
  - Query depth limiting: configurable max depth (default: 10)
  - Query complexity: cost analysis, max complexity (default: 1000)
  - Persisted queries: APQ (Automatic Persisted Queries)
  - Introspection: enabled in dev, disabled in production by default
  - GraphiQL: served at /graphql in dev mode

carpenter make:resolver PostResolver --model=Post  → generates typed stub

Acceptance Criteria:
- [ ] All decorators: @ObjectType, @Field, @Resolver, @Query, @Mutation, @Subscription
- [ ] @Arg, @Root, @Ctx, @Info parameter decorators
- [ ] DataLoader auto-batches: 10 author field resolvers → 1 User.whereIn([ids]) call
- [ ] Subscriptions over WebSocket (graphql-ws): pub/sub via EventDispatcher
- [ ] Context populated per operation from request scope
- [ ] Depth limiting: query exceeding maxDepth rejected with clear error
- [ ] Complexity limiting: expensive queries rejected before execution
- [ ] Schema-first: .graphql files in /graphql/*.graphql loaded and merged
- [ ] Error formatting: CarpenterError → GraphQL error with extensions.code
- [ ] Full resolver unit tests with mock context + mock dataloaders
```

---

**CARP-084** `[E24]` GraphQL Federation v2 & Supergraph Gateway  
**Points:** 8 | **Priority:** Medium

```
Technical Spec:
Subgraph mode:
  @Entity() @Key('id')
  class Post { @Field(() => ID) id: string; ... }

  @Resolver(Post)
  class PostResolver {
    @ResolveReference()
    resolveReference(@Root() ref: { id: string }): Promise<Post>
  }

Gateway mode (carpenter.config.ts):
  graphql: {
    mode: 'gateway',
    supergraph: 'supergraph.graphql',  // composed schema
    subgraphs: [
      { name: 'posts', url: 'http://posts-service/graphql' },
      { name: 'users', url: 'http://users-service/graphql' },
    ]
  }

Schema composition:
  carpenter gql:compose  → fetches subgraph schemas, composes supergraph.graphql
  carpenter gql:check    → validates composition (CI gate)
  carpenter gql:publish  → publishes schema to Apollo Studio / GraphOS

Acceptance Criteria:
- [ ] @Entity, @Key, @External, @Requires, @Provides directives work
- [ ] @ResolveReference resolves entity by key from gateway
- [ ] Gateway: composes subgraph schemas into unified schema
- [ ] Gateway: routes queries/mutations to correct subgraph(s)
- [ ] carpenter gql:compose fetches schemas from all subgraphs
- [ ] carpenter gql:check fails on incompatible composition
- [ ] Integration test: two in-process subgraphs + gateway
```

---

**Sprint 26 Total: 16 points**

---

### Sprint 27 — Observability: OpenTelemetry Traces, Metrics & Structured Logging (E25)

---

**CARP-085** `[E25]` Auto-Instrumentation via OpenTelemetry Traces  
**Points:** 8 | **Priority:** High

```
Design: Zero-boilerplate observability. App code contains ZERO telemetry calls.
All instrumentation is injected by the framework at integration points.

Auto-instrumented spans (all created automatically):
  HTTP:    http.server.request — method, route, status, duration, user_id
  DB:      db.query — db.system, db.statement (sanitized, no values), rows_affected
  Cache:   cache.operation — operation, cache.hit, key_hash, duration
  Queue:   job.execute — job.class, queue.name, attempt, duration
  Mail:    mail.send — mail.to (hashed), mail.subject, adapter
  Remote:  rpc.call — rpc.service, rpc.method, transport, duration
  AI:      gen_ai.invoke — gen_ai.system, gen_ai.model, prompt_tokens, completion_tokens

Trace propagation:
  HTTP:    traceparent + tracestate headers (W3C standard)
  gRPC:    grpc-traceparent metadata
  NATS:    trace-parent message header
  Kafka:   traceparent record header
  Queue:   stored in job payload, extracted by worker

OTLP configuration:
  OTEL_ENABLED=true
  OTEL_SERVICE_NAME=my-app
  OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
  OTEL_SAMPLE_RATE=0.1   # sample 10% in production

Exporters: OTLP (gRPC + HTTP), Jaeger, Zipkin, Console (dev), Noop (test)

Acceptance Criteria:
- [ ] HTTP spans created with correct attributes (method, route pattern, not full URL)
- [ ] DB spans: SQL statement sanitized (no user values), bound to HTTP span
- [ ] Cache spans: hit/miss boolean, key replaced with SHA256 hash
- [ ] Queue job spans: link between dispatch span and execute span
- [ ] AI spans: gen_ai.* semantic conventions (OTel GenAI spec)
- [ ] Trace context propagated in ALL transport adapters
- [ ] OTLP exporter sends to configured endpoint over gRPC
- [ ] Sampling: configurable, head-based by default
- [ ] Test environment: NoopTracer — no spans, no overhead
- [ ] Full tests verifying span attributes (in-memory exporter for tests)
```

---

**CARP-086** `[E25]` Metrics (Prometheus + OTLP) & Structured Logging  
**Points:** 8 | **Priority:** High

```
METRICS (OpenTelemetry Metrics API):
Auto-collected:
  http.server.request.duration    histogram  (p50, p95, p99 by route)
  http.server.active_requests     updown counter
  db.client.connections.pool      gauge (active, idle, waiting)
  queue.jobs.processed            counter (by queue, by job class)
  queue.jobs.failed               counter
  cache.operations                counter (hit, miss, by store)
  ai.tokens.consumed              counter (by model, by user_id)
  ai.request.duration             histogram (by model)

Custom metrics:
  const orders = Metrics.counter('orders.placed', { description: '...', unit: 'orders' })
  orders.add(1, { plan: 'pro', region: 'eu' })

Prometheus endpoint: GET /metrics (text/plain; version=0.0.4)
OTLP push: configurable interval (default: 30s)

STRUCTURED LOGGING:
ILogger: debug(msg, ctx?), info, warn, error, critical
Adapters: ConsolePretty (dev), ConsoleJson (prod), Pino, Winston, Null (test)

Auto-injected per log line:
  { timestamp, level, message, traceId, spanId, requestId, userId, service, version }

Sensitive data redaction (configurable list, defaults):
  Fields auto-redacted: password, token, secret, authorization, cookie,
                        creditCard, ssn, apiKey, privateKey, refreshToken

Log levels by namespace:
  LOG_LEVELS="http:debug,db:warn,queue:info,*:info"

Audit logger (security events → separate stream):
  AuditLog.record('user.login', { userId, ip, success: true })
  AuditLog.record('permission.denied', { userId, resource, action })

Acceptance Criteria:
- [ ] /metrics endpoint returns valid Prometheus text format
- [ ] All auto-collected metrics present and correct
- [ ] Custom counter/histogram/gauge/updown counter API works
- [ ] JSON logs in production: every line parseable as JSON
- [ ] Pretty logs in dev: coloured, aligned, readable
- [ ] traceId/spanId in every log line when in a traced request context
- [ ] Sensitive field redaction: configured fields replaced with [REDACTED]
- [ ] Audit logger writes to separate log stream (configurable output)
- [ ] Full tests: metric values verified + log structure verified
```

---

**Sprint 27 Total: 16 points**

---

### Sprint 28 — Multi-tenancy System (E26)

---

**CARP-087** `[E26]` Multi-tenancy Core — Tenant Context & Data Isolation  
**Points:** 13 | **Priority:** High

```
Design: Multi-tenancy is a first-class framework feature, not a library add-on.
All data isolation is AUTOMATIC — developers never manually add tenant_id conditions.

Tenant Resolution Strategies:
  Subdomain:  acme.myapp.com → tenant 'acme'
  Path:       /t/acme/dashboard → tenant 'acme'
  Header:     X-Tenant-ID: acme
  JWT claim:  { tenantId: 'acme' } in auth token
  Session:    stored after first resolution

TenantContext (AsyncLocalStorage — no prop drilling):
  currentTenant(): Tenant      // throws if no tenant context
  currentTenantOrNull(): Tenant | null

Database Isolation Strategies (configured per app):

  1. Separate Databases:
     - TenantDatabaseResolver: looks up tenant's DB DSN in central registry
     - Carpenter maintains bounded connection pool per tenant
     - Migrations: per-tenant migration state table

  2. Separate Schemas (PostgreSQL):
     - search_path set to tenant schema per connection
     - Schema created on tenant provisioning
     - Migrations run per schema

  3. Shared Database with tenant_id (simplest):
     - TenantScope: global scope adds WHERE tenant_id = currentTenant().id
     - Mass assignment: tenant_id excluded from $fillable — set by framework only
     - Dev mode: query analyzer THROWS if a query on a tenantable model lacks tenant scope

Cache Isolation:
  All cache keys auto-prefixed:  {tenantId}:{originalKey}
  Flush by tenant:  Cache.forTenant(tenant).flush()

Storage Isolation:
  All paths auto-prefixed:  tenants/{tenantId}/{originalPath}
  Storage.forTenant(tenant).put('uploads/file.jpg', data)

Config per tenant:
  TenantConfig: override specific config keys per tenant
  tenant.config('features.ai_enabled')  // tenant-level feature flags
  tenant.config('limits.storage_gb')

Acceptance Criteria:
- [ ] TenantResolver resolves from subdomain, path prefix, header, JWT claim
- [ ] currentTenant() available anywhere in request lifecycle without prop drilling
- [ ] Shared DB: TenantScope applied to ALL model queries for tenantable models
- [ ] Dev mode: missing tenant scope on tenantable model THROWS TenantScopeException
- [ ] Separate DB: correct tenant connection used; connection pooled (max 5 per tenant)
- [ ] Schema isolation: search_path set correctly per request
- [ ] Cache keys auto-prefixed: verified by MockCacheStore assertions
- [ ] Storage paths auto-prefixed: verified by MockStorageAdapter assertions
- [ ] TenantMiddleware runs before any route handler
- [ ] Full tests: two concurrent requests for different tenants → different data
- [ ] Integration test: shared DB strategy, tenant A cannot see tenant B's records
```

---

**CARP-088** `[E26]` Tenant Lifecycle, CLI & Migration Management  
**Points:** 8 | **Priority:** Medium

```
Technical Spec:
TenantManager service:
  createTenant(data: CreateTenantDTO): Promise<Tenant>  // provisions all resources
  suspendTenant(id: string): Promise<void>
  deleteTenant(id: string, options: DeleteOptions): Promise<void>  // GDPR-compliant
  getTenant(id: string): Promise<Tenant>
  listTenants(filter?: TenantFilter): Promise<Tenant[]>

Tenant provisioning pipeline (all-or-nothing atomic):
  1. Create tenant record in central registry
  2. Create database / schema (based on isolation strategy)
  3. Run migrations for new tenant
  4. Seed default data (roles, settings)
  5. Dispatch TenantCreated event
  → On failure: rollback all steps, dispatch TenantProvisioningFailed event

Tenant model (central registry DB):
  id, slug, name, primaryDomain, plan, status, settings, createdAt, suspendedAt, deletedAt

CLI commands:
  carpenter tenant:create --name="Acme Corp" --domain=acme
  carpenter tenant:migrate [--tenant=acme] [--all]   // migrate specific or all tenants
  carpenter tenant:seed [--tenant=acme] [--class=TenantSeeder]
  carpenter tenant:list [--status=active]
  carpenter tenant:suspend --tenant=acme
  carpenter tenant:delete --tenant=acme --confirm

GDPR delete: removes tenant data from all stores (DB, cache, storage, queue, audit log)

Acceptance Criteria:
- [ ] TenantManager.createTenant() runs full provisioning pipeline
- [ ] Provisioning is atomic: failure rolls back all steps
- [ ] TenantCreated event dispatched after successful creation
- [ ] carpenter tenant:migrate runs pending migrations per tenant
- [ ] GDPR delete: tenant data removed from DB, cache, and storage
- [ ] Tenant suspension: all requests for suspended tenant return 503
- [ ] Full tests: provisioning pipeline with mock DB and MockEventDispatcher
```

---

**Sprint 28 Total: 21 points**

---

### Sprint 29 — CarpenterAdmin Panel (E27)

---

**CARP-089** `[E27]` CarpenterAdmin Core — Auto-Generated CRUD  
**Points:** 13 | **Priority:** Medium

```
Design: Register a model → get a full CRUD admin interface.
Like Laravel Nova / Django Admin — but built on CarpenterUI, fully typed.

@AdminResource(Post)
class PostResource extends BaseAdminResource<Post> {
  // Fields shown in table and form:
  fields(): AdminField[] {
    return [
      TextField.make('title').sortable().searchable(),
      TextareaField.make('body').hideFromIndex(),
      SelectField.make('status').options(['draft', 'published']),
      BelongsToField.make('author', UserResource),
      DateTimeField.make('publishedAt').nullable(),
      ImageField.make('featuredImage').disk('s3'),
      BooleanField.make('featured'),
    ]
  }

  // Filters on index page:
  filters(): AdminFilter[] {
    return [ StatusFilter, DateRangeFilter ]
  }

  // Actions (bulk or single):
  actions(): AdminAction[] {
    return [ PublishAction, DeleteAction ]
  }

  // Authorization:
  authorizedTo(ability: string, user: User): boolean {
    return user.can(ability, Post)   // delegates to Gate
  }
}

Features:
  - Index: paginated list with search, filter, sort, bulk actions
  - Show: detail view with all fields
  - Create: form with validation (uses model's FormRequest if defined)
  - Edit: pre-populated form
  - Delete: with soft-delete support
  - Relationships: inline BelongsTo, HasMany panels
  - Media: file upload with preview (Storage integration)
  - Audit trail: who changed what, when (integrates with Audit Log)
  - Impersonation: admin can log in as any user
  - Activity feed: recent creates/updates/deletes per resource

carpenter make:admin-resource Post  → generates PostResource stub

Acceptance Criteria:
- [ ] Registering a resource generates all 5 CRUD routes
- [ ] Index: paginated, searchable, sortable, filterable
- [ ] All field types render correctly in index/show/form
- [ ] BelongsToField: searchable async dropdown
- [ ] ImageField: upload to configured Storage disk, preview in admin
- [ ] Bulk actions: select all, execute action on selection
- [ ] Authorization: authorizedTo gates all operations
- [ ] CarpenterUI-based: fully reactive, no full page reloads
- [ ] carpenter make:admin-resource generates correct stub
- [ ] Full tests: admin routes secured by auth, correct data returned
```

---

**CARP-090** `[E27]` CarpenterAdmin Metrics Dashboard & Custom Pages  
**Points:** 8 | **Priority:** Low

```
Technical Spec:
- AdminDashboard: customizable card-based metrics dashboard
- MetricCard, TrendCard, ValueCard, ChartCard built-in
- Custom admin pages: extend BasePage, register at custom path
- Dark mode: respects OS preference, toggleable

class AppDashboard extends AdminDashboard {
  cards(): DashboardCard[] {
    return [
      ValueCard.make('Total Users', () => User.count()),
      TrendCard.make('New Signups', () => User.wherePeriod('week').count()),
      ChartCard.make('Revenue', RevenueMetric),
    ]
  }
}

Acceptance Criteria:
- [ ] Dashboard renders metric cards with live data
- [ ] Cards auto-refresh on configurable interval
- [ ] Custom pages registered and accessible
- [ ] Dark mode toggle persists to localStorage
- [ ] Full tests: dashboard data endpoints secured + correct
```

---

**Sprint 29 Total: 21 points**

---

### Sprint 30 — WASM Module Integration & Advanced Security (E28 + E29)

---

**CARP-091** `[E28]` WASM Module Loader & TypeScript Bindings  
**Points:** 8 | **Priority:** Medium

```
As a developer,
I want to load and call WASM modules compiled from Rust, C, C++, Go, or Zig
With TypeScript types generated from the WASM interface,
So that I can use high-performance native code without leaving TypeScript.

Technical Spec (@carpentry/wasm):
  WasmModule class:
    static load(path: string): Promise<WasmModule>  // lazy-loaded on first use
    call<TIn, TOut>(fn: string, input: TIn): TOut   // calls exported WASM function
    stream<TIn, TOut>(fn: string, input: TIn): AsyncIterable<TOut>  // streaming

  Integration: WASM modules registered in IoC container
  app.wasm('image-processor', 'wasm/image_processor.wasm')
  const processor = app.make<IImageProcessor>('image-processor')

  carpenter generate:wasm-bindings image_processor.wasm --lang=typescript
    → Generates: typed TypeScript interface from WASM exports via wit-bindgen / wasm-bindgen

  WASI support: WASM modules with WASI interface can access filesystem sandbox

  Worker threads: CPU-intensive WASM calls run in Bun/Node Worker to avoid blocking event loop

Use Cases (provided as examples):
  - Rust image resizing / processing (imagemagick-style)
  - C++ PDF generation (libharu-based)
  - Go cryptography (post-quantum algorithms)
  - Zig compression (zstd, brotli)
  - Python (pyodide) for data science workflows

Acceptance Criteria:
- [ ] WasmModule.load() initializes WASM module from file path or URL
- [ ] call() invokes exported function with TypeScript-typed input/output
- [ ] Worker thread: CPU-bound calls dispatched to Worker automatically
- [ ] carpenter generate:wasm-bindings generates correct TypeScript interface
- [ ] IoC registration: WASM modules resolved like any other service
- [ ] WASI sandbox: file access limited to configured directory
- [ ] Example: Rust image processor WASM integrated in examples/ repo
- [ ] Full unit tests with mock WASM module
```

---

**CARP-092** `[E29]` Advanced Security: Supply Chain, CSP & Dependency Hardening  
**Points:** 8 | **Priority:** High

```
Supply Chain Security:
  - Dependency audit gate in CI: npm audit --audit-level=high fails build
  - Lockfile integrity: package-lock.json / bun.lockb committed and verified
  - Allowlist policy: only approved packages in core; external reviewed via PR
  - SBOM generation: carpenter sbom → outputs CycloneDX SBOM JSON
  - Provenance: npm publish with --provenance flag

Content Security Policy (CSP):
  CspMiddleware: generates nonce per request, injects into script/style tags
  config/csp.ts:
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'nonce-{nonce}'"],
    styleSrc: ["'self'", "'nonce-{nonce}'"],
    reportTo: '/csp-reports'
  CarpenterUI: nonce automatically applied to all inline scripts/styles
  Violation reporting endpoint: POST /csp-reports → logs violations

Subresource Integrity (SRI):
  All CDN assets in HTML get integrity="sha384-..." hash attribute
  carpenter build generates SRI hashes for all assets

Secret Scanning:
  Pre-commit hook: carpenter secrets:scan scans staged files for API keys, tokens
  Uses regex patterns for: AWS keys, GitHub tokens, Anthropic keys, private keys
  CI gate: carpenter secrets:scan --all-files runs on every PR

Dependency Confusion Protection:
  .npmrc: registry=https://registry.npmjs.org  (no fallback to package manager guessing)
  All internal packages scoped under @carpentry/ or custom org scope

Acceptance Criteria:
- [ ] npm audit gate: high severity vulns fail CI build
- [ ] SBOM generation: valid CycloneDX JSON with all direct + transitive deps
- [ ] CSP middleware: unique nonce per request, injected into all inline assets
- [ ] CarpenterUI: nonce applied to compiled inline scripts automatically
- [ ] SRI: integrity attributes on all externally loaded assets
- [ ] Secret scanner: detects 20+ common secret patterns
- [ ] Pre-commit hook: blocks commit if secrets detected
- [ ] Dependency confusion: .npmrc scoped to correct registry
- [ ] Full tests for CSP nonce injection and SRI hash generation
```

---

**Sprint 30 Total: 16 points**

---

### Sprint 31 — Feature Flags & Experimentation (E30)

---

**CARP-093** `[E30]` Feature Flags System  
**Points:** 8 | **Priority:** Medium

```
Technical Spec (@carpentry/flags):
interface IFlagProvider {
  isEnabled(flag: string, context?: FlagContext): Promise<boolean>
  getValue<T>(flag: string, defaultValue: T, context?: FlagContext): Promise<T>
  getAllFlags(context?: FlagContext): Promise<Record<string, boolean>>
}

FlagContext: { userId, tenantId, email, plan, country, customAttributes }

Providers:
  LocalProvider:     flags in config/flags.ts — for simple on/off
  DatabaseProvider:  flags in feature_flags table — toggle without deploy
  LaunchDarklyProvider, UnleashProvider, GrowthBookProvider — third-party
  MemoryProvider:    in-memory for tests

Evaluation strategies (per flag):
  Boolean:    on | off
  Percentage: 20% of users see feature (stable hashing by userId)
  UserList:   specific user IDs
  PlanBased:  only 'pro' and 'enterprise' plans
  TenantBased: specific tenant IDs
  DateRange:  feature active between two dates (for scheduled launches)
  GeoRegion:  feature active in specific countries

In code:
  if (await Flags.isEnabled('new-dashboard', { userId: user.id })) { ... }
  const limit = await Flags.getValue<number>('rate-limit', 100, ctx)

In CarpenterUI templates:
  <FeatureFlag flag="new-dashboard">
    <NewDashboard /> <template #fallback> <OldDashboard /> </template>
  </FeatureFlag>

A/B Testing:
  const variant = await Experiment.variant('checkout-flow', userId)
  // variant: 'control' | 'variant-a' | 'variant-b'
  Experiment.track('checkout.completed', userId, variant)

Acceptance Criteria:
- [ ] All providers implement IFlagProvider
- [ ] LocalProvider: flags from config/flags.ts
- [ ] DatabaseProvider: flags from DB, cached in Cache, invalidated on change
- [ ] Percentage rollout: stable (same userId always same result), configurable seed
- [ ] UserList and TenantBased strategies working
- [ ] DateRange: automatic enable/disable at scheduled times
- [ ] <FeatureFlag> CarpenterUI component
- [ ] A/B experiment tracking integration with analytics event
- [ ] Flags.fake(): MemoryProvider with overrideFlag() for tests
- [ ] Full tests for each evaluation strategy
```

---

**Sprint 31 Total: 8 points** *(intentionally lighter — buffer for carry-over and tech debt)*

---

### Sprint 32 — Real-time Collaboration Primitives (E31)

---

**CARP-094** `[E31]` Real-time Presence & Collaborative Document Primitives  
**Points:** 13 | **Priority:** Low

```
Technical Spec (@carpentry/realtime):
Presence:
  PresenceChannel('room:123'):
    - track which users are in a channel
    - presence.join(user, metadata)
    - presence.leave(user)
    - presence.list(): User[]
    - Events: user_joined, user_left, updated
  Backed by: Redis pub/sub + hash for state

CRDT Collaborative Documents (Yjs integration):
  CollaborativeDoc: wraps Yjs Y.Doc
  - Persistence adapter: saves Y.Doc updates to DB / Redis
  - Sync: WebSocket-based (y-websocket protocol)
  - Awareness: cursor positions, user info
  
  class CollaborativeDoc {
    static find(id: string): Promise<CollaborativeDoc>
    getMap(name: string): Y.Map<T>
    getText(name: string): Y.Text
    applyUpdate(update: Uint8Array): void
    onUpdate(handler: (update: Uint8Array) => void): void
  }

  Persistence adapters: Database, Redis
  CarpenterUI component: <CollaborativeEditor docId="..." />

Live Cursors:
  Broadcast cursor positions via Awareness protocol
  Render other users' cursors in CarpenterUI editor

Acceptance Criteria:
- [ ] Presence: join/leave/list working via Redis pub/sub
- [ ] Presence events broadcast to channel members
- [ ] CollaborativeDoc: Y.Doc updates persisted and replayed to new connections
- [ ] Multiple clients editing same doc: conflict-free via CRDT
- [ ] <CollaborativeEditor> renders with live cursors
- [ ] Database persistence adapter: stores Yjs updates as binary blobs
- [ ] Full integration test: two mock WebSocket clients editing same document
```

---

**Sprint 32 Total: 13 points**

---

### Sprint 33 — Developer Experience & DX Tooling (E32)

---

**CARP-095** `[E32]` TypeScript Language Service Plugin & IDE Integrations  
**Points:** 8 | **Priority:** High

```
Technical Spec (@carpentry/ts-plugin):
TypeScript Language Service Plugin:
  - Route completions: route('posts.|') → shows 'index', 'show', 'create', etc.
  - Config key completions: config('database.|') → shows all config keys
  - View completions: this.view('Pages/|') → shows existing .carp page files
  - Translation key completions: __('auth.|') → shows translation keys
  - Model attribute type inference: User.find(1) → fully typed User instance
  - Facade type inference: DB.table('users') → returns typed QueryBuilder<User>

VS Code Extension (@carpentry/vscode):
  - .carp file syntax highlighting and IntelliSense
  - Route hover: hover over route name → shows URL, middleware, controller
  - Jump to definition: Ctrl+Click on route name → opens controller method
  - Diagnostic warnings: unused route definitions, missing controllers
  - Snippet library: all carpenter make:* as VS Code snippets
  - CarpenterUI component auto-import

Zed & Neovim:
  - LSP config snippets for both editors in documentation

carpenter doctor:
  - Diagnoses common configuration issues
  - Checks: APP_KEY set, DB connection valid, required packages installed
  - Reports: unused service providers, missing env vars, config conflicts

Acceptance Criteria:
- [ ] TS plugin: route() shows valid named routes
- [ ] TS plugin: config() shows valid config keys
- [ ] TS plugin: this.view() shows existing page files
- [ ] VS Code: .carp files highlighted correctly
- [ ] VS Code: Ctrl+Click on controller → opens file at method
- [ ] VS Code snippets: all make:* commands as snippets
- [ ] carpenter doctor: reports 5+ common issues with actionable fixes
- [ ] Full tests for TS plugin completions using TS compiler API
```

---

**CARP-096** `[E32]` Hot Module Replacement (HMR) & Dev Server  
**Points:** 8 | **Priority:** High

```
Technical Spec:
carpenter serve --watch:
  - Watches: routes/, app/, resources/, config/
  - Backend changes: re-runs affected module, re-registers routes (no full restart)
  - Frontend (.carp) changes: HMR via WebSocket to browser (no page reload)
  - State preservation: component state preserved across HMR updates
  - Error overlay: compile/runtime errors shown as overlay in browser

HMR Protocol:
  - Dev server WebSocket on separate port (ws://localhost:35729)
  - Message types: full-reload | module-update | style-update | error
  - Module graph: tracks dependencies, propagates updates up the graph

carpenter inspect:routes:
  - Pretty-prints all registered routes with method, path, middleware, controller

carpenter inspect:container:
  - Lists all IoC bindings with their resolved type and scope

carpenter inspect:events:
  - Lists all registered event → listener mappings

carpenter perf:profile [--url=/api/posts]:
  - Runs 1000 requests, reports p50/p95/p99 latency + throughput

Acceptance Criteria:
- [ ] Backend file change: routes re-registered without process restart
- [ ] .carp file change: HMR update sent, component re-rendered, state preserved
- [ ] Error overlay: TypeScript compile errors shown in browser
- [ ] carpenter inspect:routes shows formatted route table
- [ ] carpenter inspect:container shows all bindings with scopes
- [ ] carpenter perf:profile outputs latency percentiles and RPS
- [ ] HMR tests: mock file watcher → WebSocket message sent to mock client
```

---

**Sprint 33 Total: 16 points**

---

### Sprint 34 — HTTP/3, WebTransport & Islands Architecture (E33 + E34)

---

**CARP-097** `[E33]` HTTP/3, QUIC & WebTransport  
**Points:** 8 | **Priority:** Medium

```
Technical Spec:
HTTP/3 (Bun native QUIC):
  - HttpServer adapter detects Bun QUIC availability
  - Alt-Svc header: Alt-Svc: h3=":443"; ma=86400 on all HTTP/1.1 responses
  - Certificate management: auto-detect from config
  - HTTP/3 falls back to HTTP/2 → HTTP/1.1 gracefully

WebTransport (browser ↔ server bidirectional streams):
  interface IWebTransportSession {
    sendDatagram(data: Uint8Array): void
    openUnidirectionalStream(): WritableStream
    incomingUnidirectionalStreams: ReadableStream
    openBidirectionalStream(): { readable, writable }
  }

  Use cases: real-time gaming, live collaboration, low-latency data feeds

  carpenter configure:webtransport → sets up certificate for local dev

Performance benefits over HTTP/2:
  - No head-of-line blocking at transport layer (QUIC)
  - 0-RTT reconnection on network change (mobile handover)
  - Multiplexed streams without TCP congestion entanglement

Acceptance Criteria:
- [ ] HTTP/3 enabled when Bun QUIC available and TLS configured
- [ ] Alt-Svc header present on all responses
- [ ] WebTransport: IWebTransportSession interface implemented
- [ ] WebTransport datagram: send/receive Uint8Array payloads
- [ ] Bidirectional streams: open, write, read, close
- [ ] Graceful degradation: HTTP/1.1 works when HTTP/3 not available
- [ ] Integration test: WebTransport session established with test browser (Playwright)
```

---

**CARP-098** `[E34]` Islands Architecture & Partial Hydration  
**Points:** 8 | **Priority:** High

```
Design: Ship static HTML by default. Hydrate only interactive components.
Result: Near-zero JavaScript for static content; full interactivity where needed.

Technical Spec:
Island directives in .carp templates:
  <Counter client:load />        → hydrate immediately on page load
  <Comments client:idle />       → hydrate when browser is idle
  <Map client:visible />         → hydrate when element enters viewport
  <Modal client:media="(min-width: 768px)" /> → hydrate on media query match
  <InfiniteScroll client:only /> → client-only, never SSR'd

Non-island components:
  Rendered to static HTML on server. Zero JS sent for these components.
  They cannot use signals or event handlers.

Island boundaries:
  Each island is independently hydrated — isolated signal/state scope
  Islands communicate via: URL (query params), events (browser CustomEvent), or shared store

Partial hydration on page update (bridge navigations):
  Only islands in the NEW page that weren't in the OLD page get hydrated
  Islands shared between pages are PRESERVED (no unmount/remount)

carpenter build --islands: analyzes .carp files, splits bundle per island

Acceptance Criteria:
- [ ] client:load components hydrated on DOMContentLoaded
- [ ] client:idle components hydrated via requestIdleCallback
- [ ] client:visible components hydrated via IntersectionObserver
- [ ] client:only components rendered client-side only (no SSR)
- [ ] Static components: zero bytes of JavaScript sent
- [ ] Bundle splitting: each island gets its own chunk (code splitting)
- [ ] Bridge navigations: shared islands preserved across page transitions
- [ ] Lighthouse: page with only static content scores 100 Performance
- [ ] Full tests: verify which components hydrate and when
```

---

**Sprint 34 Total: 16 points**

---

### Sprint 35 — Performance Benchmarks, SLA Specification & Stress Tests (E35)

---

**CARP-099** `[E35]` Performance Benchmark Suite & SLA Contracts  
**Points:** 8 | **Priority:** High

```
Technical Spec:
carpenter benchmark: runs full benchmark suite against a local Carpenter app

Benchmark categories:
  1. Raw HTTP throughput:         hello-world route, no middleware
  2. Middleware pipeline:         10 middleware layers
  3. JSON response:               Return 100-item array
  4. ORM query (single):          User.find(1) → JSON
  5. ORM query (list + relation):  Post.with('author').limit(20).get()
  6. Auth middleware:             JWT verification per request
  7. Cache read:                  Cache.get() hit → JSON response
  8. Full page SSR:               CarpenterUI SSR of complex page
  9. Concurrent connections:      500 concurrent clients
  10. Cold start time:            Time from process start to first successful request

SLA Contracts (enforced in CI — build fails if not met):
  Metric                          | Bun Target    | Node Target
  --------------------------------|---------------|-------------
  Hello World RPS                 | > 80,000/s    | > 30,000/s
  Hello World p99 latency         | < 5ms         | < 15ms
  Full ORM request p99 latency    | < 25ms        | < 50ms
  Cold start time                 | < 100ms       | < 500ms
  SSR render time (complex page)  | < 10ms        | < 25ms
  Memory per idle connection      | < 2KB         | < 5KB
  Peak memory (1000 req/s)        | < 256MB       | < 512MB

Comparison benchmarks (published in docs):
  Framework               | RPS (hello world) | p99 Latency
  ------------------------|-------------------|------------
  Carpenter (Bun)         | ~80,000           | ~4ms
  Carpenter (Node)        | ~30,000           | ~12ms
  Express (Node)          | ~10,000           | ~40ms
  Fastify (Node)          | ~25,000           | ~15ms
  NestJS (Node)           | ~8,000            | ~55ms
  Hono (Bun)              | ~90,000           | ~3ms  (raw, no features)

carpenter stress: long-running stress test (10 min, escalating load)
  - Reports: throughput over time, memory growth (leak detection), error rate
  - FAILS if: memory grows > 50MB over 10 min (leak indicator)
  - FAILS if: error rate > 0.01% at any load level

Acceptance Criteria:
- [ ] carpenter benchmark runs all 10 categories, outputs markdown table
- [ ] SLA contracts enforced in CI (dedicated benchmark CI job)
- [ ] Bun target: hello world > 80,000 RPS verified
- [ ] Cold start < 100ms verified
- [ ] carpenter stress: 10-minute run with escalating load
- [ ] Memory leak test: < 50MB growth over stress run
- [ ] Benchmark results committed to repo after each release
- [ ] Comparison table regenerated and published with each release
```

---

**CARP-100** `[E35]` Load Test Scenarios & Chaos Engineering  
**Points:** 8 | **Priority:** Medium

```
Technical Spec (@carpentry/chaos):
Load test scenarios (using k6 or autocannon):
  - Spike test: 0 → 1000 req/s in 10s, sustain 60s, back to 0
  - Soak test: 200 req/s for 60 minutes (leak detection)
  - Stress test: escalate until first error (find breaking point)
  - Volume test: large payloads (1MB JSON bodies)

Chaos Engineering tools:
  ChaosMiddleware (dev/staging only):
    chaos: {
      latency: { probability: 0.1, delay: 500 },  // 10% of requests get +500ms
      error: { probability: 0.05, status: 503 },   // 5% return 503
      timeout: { probability: 0.02 }               // 2% timeout
    }

  ChaosDatabaseAdapter: wraps real adapter, introduces failures
    - Random connection failures (configurable probability)
    - Slow queries (configurable delay injection)
    - Deadlock simulation

  ChaosQueueAdapter: drops jobs, introduces processing delays

  Chaos scenarios validate:
    - Circuit breaker opens on DB failures
    - Retry logic recovers from transient errors
    - Graceful degradation serves cached responses when DB unavailable
    - Timeouts propagate correctly and return 504, not hang

carpenter chaos:run --scenario=db-flap --duration=60s

Acceptance Criteria:
- [ ] ChaosMiddleware injects latency/errors at configured probability
- [ ] ChaosDatabaseAdapter introduces random failures
- [ ] Chaos scenarios run in staging CI pipeline
- [ ] Circuit breaker verified: opens after threshold failures under chaos
- [ ] Graceful degradation: cached responses served when DB under chaos
- [ ] All chaos components disabled/unavailable in production builds
- [ ] Full tests: chaos scenarios produce expected failure patterns
```

---

**Sprint 35 Total: 16 points**

---

### Sprints 36–40 — Integration, Hardening, Documentation & GA Release

---

### Sprint 36 — Cross-Package Integration Testing

**Sprint Goal:** End-to-end integration tests covering the full stack — all packages working together.

**CARP-101 through CARP-105** `[Integration]` — **40 points**

```
Stories:
CARP-101: Full-stack blog app test suite (web routes + CarpenterUI + ORM + Auth + Cache)
CARP-102: API-only app test suite (REST + JWT + Rate limit + Queue + Mail)
CARP-103: Polyglot services integration tests (Carpenter + mock Rust gRPC service)
CARP-104: Multi-tenant application test suite (shared DB + per-tenant isolation verified)
CARP-105: Edge deployment integration (CF Workers emulator + D1 + KV)

Each story:
- [ ] Complete app built from scratch using only public Carpenter APIs
- [ ] 100% test coverage using @carpentry/testing mocks
- [ ] Zero TypeScript errors under strict mode
- [ ] All SOLID principles verified in code review
- [ ] Performance within SLA targets
```

---

### Sprint 37 — Security Audit & Penetration Testing

**Sprint Goal:** Full security audit addressing all threats in the Threat Model (Section 8).

**CARP-106 through CARP-110** — **35 points**

```
Stories:
CARP-106: OWASP Top 10 verification (automated + manual checks against each item)
CARP-107: Authentication & session security audit (timing attacks, fixation, CSRF)
CARP-108: Injection prevention audit (SQL, XSS, SSRF, path traversal, prototype pollution)
CARP-109: Dependency vulnerability audit + SBOM generation
CARP-110: Security headers audit (CSP, HSTS, SRI, CORP, COOP, COEP)

Each story:
- [ ] Automated scan with OWASP ZAP
- [ ] Manual review of auth and input handling code paths
- [ ] All findings documented, prioritized, and resolved
- [ ] Penetration test report committed to repo (redacted version in public docs)
```

---

### Sprint 38 — Developer Documentation & Migration Guides

**Sprint Goal:** Complete documentation covering all 35 epics with worked examples.

**CARP-111 through CARP-115** — **40 points**

```
Docs site (docs.carpenter.dev):
CARP-111: Core concepts: IoC, Service Providers, Middleware, Routing — with diagrams
CARP-112: CarpenterUI deep-dive: .carp format, signals, SSR, Islands, HMR
CARP-113: Polyglot microservices guide: step-by-step Rust, Go, Python examples
CARP-114: AI features guide: streaming, agents, RAG, MCP, guard middleware
CARP-115: Deployment guides: Bun bare metal, Docker, Kubernetes, Cloudflare, Vercel

Each doc:
- [ ] Prose explanation + architecture diagram
- [ ] Runnable code examples (tested in CI)
- [ ] API reference (generated from TSDoc)
- [ ] "From X to Carpenter" migration guides (Laravel, NestJS, Express, Next.js)
```

---

### Sprint 39 — Community, Ecosystem & Plugin Architecture

**Sprint Goal:** Plugin/extension system, starter kits, and community contribution scaffolding.

**CARP-116 through CARP-120** — **30 points**

```
CARP-116: Plugin API — third-party packages can extend Carpenter via ServiceProvider + published contracts
CARP-117: Starter kits: SaaS starter, Blog starter, API starter, Admin starter
CARP-118: carpenter plugin:install <name> — discovers, installs, auto-registers plugins
CARP-119: Plugin marketplace discovery: carpenter plugin:search <query>
CARP-120: Community contribution guide: ADR template, RFC template, security disclosure policy

Plugin API requirements:
- [ ] Plugins register via standard ServiceProvider
- [ ] Plugins can add routes, commands, middleware, config, migrations
- [ ] Plugin contracts are published: 3rd party can implement IAuthGuard, INotificationChannel, etc.
- [ ] carpenter make:plugin generates plugin package scaffold
```

---

### Sprint 40 — Performance Polish, Final QA & v1.0 Release

**Sprint Goal:** 1.0.0 GA release — all features complete, docs live, benchmarks published.

**CARP-121 through CARP-125** — **25 points**

```
CARP-121: Performance polish — profile hot paths, optimize IoC resolution, ORM query compilation
CARP-122: Final API review — ensure all public APIs are stable, mark experimental APIs clearly
CARP-123: Changelog and migration guide for pre-1.0 users (if any)
CARP-124: npm publish all @carpentry/* packages with provenance
CARP-125: Launch: announcement blog post, demo video, Product Hunt launch

Release checklist:
- [ ] All 125 stories Done (Definition of Done met)
- [ ] SLA benchmarks passing on Bun and Node
- [ ] Zero open critical/high security issues
- [ ] Documentation covers 100% of public API surface
- [ ] At least 3 complete example applications
- [ ] All packages at 90%+ test coverage (100% for core + container)
```

---

### Sprint 41 — Broadcasting, Search, Health, Audit, Webhooks, Encryption & Extended Adapters (E36–E40)

**Sprint Goal:** Ship 6 new optional packages (broadcasting, search, audit, webhook, health, encrypt) plus 6 new adapters (db-turso, queue-sqs, queue-database, cache-memcached, storage-gcs, storage-azure). Add 5 new core contracts (ISearchEngine, IHealthChecker, IAuditLogger, IWebhookReceiver, IEncrypter).

**CARP-126 through CARP-137** — **36 points**

```
CARP-126 [E39]: HealthChecker — composite aggregator with Database, Cache, Memory built-in checks (3 pts)
CARP-127 [E39]: AesEncrypter — AES-256-GCM field-level encryption using Node.js crypto (3 pts)
CARP-128 [E36]: BroadcastManager — channel-based pub/sub with Log, Null drivers + IBroadcaster contract (3 pts)
CARP-129 [E36]: Pusher/Soketi/Ably broadcast adapters (5 pts)
CARP-130 [E37]: SearchManager — full-text search abstraction with ISearchEngine contract (3 pts)
CARP-131 [E37]: Meilisearch + Typesense search adapters (5 pts)
CARP-132 [E38]: AuditManager — audit logging with change tracking, database + file drivers (3 pts)
CARP-133 [E38]: WebhookReceiver — signature verification for Stripe, GitHub, Shopify, custom providers (3 pts)
CARP-134 [E40]: db-turso adapter — @libsql/client with edge-friendly embedded replicas (2 pts)
CARP-135 [E40]: queue-sqs + queue-database adapters — AWS SQS and ORM-backed queue drivers (3 pts)
CARP-136 [E40]: cache-memcached adapter — memjs-based Memcached cache store (2 pts)
CARP-137 [E40]: storage-gcs + storage-azure adapters — Google Cloud Storage and Azure Blob Storage (2 pts)

Core contracts added:
- ISearchEngine (search/index, search/search, search/remove, search/createIndex, search/dropIndex)
- IHealthChecker (health/register, health/check) + IHealthCheck (single probe)
- IAuditLogger (audit/log, audit/query)
- IWebhookReceiver (webhook/on, webhook/onAny, webhook/handle)
- IEncrypter (encrypt/encrypt, encrypt/decrypt, encrypt/generateKey)

Acceptance criteria:
- [ ] All 12 packages scaffolded with package.json, tsconfig.json, src/index.ts
- [ ] 5 new contract interfaces in @carpentry/core/contracts and exported from barrel
- [ ] HealthChecker, AesEncrypter fully implemented (zero external deps)
- [ ] BroadcastManager Log/Null drivers working end-to-end
- [ ] SearchManager, AuditManager, WebhookReceiver have stub implementations
- [ ] All 6 adapter packages have config types and stub implementations
- [ ] encrypt package is private: true (tier-1 primitive in bundle)
- [ ] 90%+ test coverage for HealthChecker and AesEncrypter
```

---

### Sprint 42 — Islands UI Adapters, Charts & Icons (E41)

**Sprint Goal:** Ship the framework-facing islands UI layer: `@carpentry/ui-react`, `@carpentry/ui-vue`, `@carpentry/ui-svelte`, `@carpentry/ui-solid`, `@carpentry/ui-charts`, and `@carpentry/icons`. Standardize `createCarpenterApp()`, `usePage()`, `useForm()`, and `Link` across adapters.

**CARP-138 through CARP-145** — **24 points**

```
CARP-138 [E41]: ui-react adapter — React-facing createCarpenterApp, usePage, useForm, Link wrapper (3 pts)
CARP-139 [E41]: ui-vue adapter — Vue-facing createCarpenterApp, usePage, useForm, Link wrapper (3 pts)
CARP-140 [E41]: ui-svelte adapter — Svelte-facing createCarpenterApp, usePage, useForm, Link wrapper (3 pts)
CARP-141 [E41]: ui-solid adapter — Solid-facing createCarpenterApp, usePage, useForm, Link wrapper (3 pts)
CARP-142 [E41]: ui-charts package — chart dataset helpers and islands-friendly chart primitives (3 pts)
CARP-143 [E41]: icons package — IIconProps plus placeholder UI icons and country flags (3 pts)
CARP-144 [E41]: adapter parity — align Link/usePage/useForm semantics across all framework packages (3 pts)
CARP-145 [E41]: adapter smoke tests — package exports, peer dependencies, and scaffold validation (3 pts)

Acceptance criteria:
- [ ] All 6 packages scaffolded with package.json, tsconfig.json, src/index.ts
- [ ] ui-react peers: react + react-dom
- [ ] ui-vue peers: vue
- [ ] ui-svelte peers: svelte
- [ ] ui-solid peers: solid-js
- [ ] Every adapter exports createCarpenterApp(), usePage(), useForm(), and Link
- [ ] icons exports IIconProps and placeholder SVG components for UI icons and country flags
- [ ] CLI feature catalog exposes the 6 new optional packages
```

---

## 5. Polyglot Microservices Specification

### 5.1 The Developer Experience Promise

```
// A Rust timetable engine, called from TypeScript:

// 1. Define the contract once in CSDL:
//    carpenter generate:client timetable.service.yaml --lang=typescript
//    carpenter generate:server timetable.service.yaml --lang=rust

// 2. In app code — looks exactly like a local service:
@Injectable()
class TimetableController extends BaseController {
  constructor(
    @Inject(ITimetableService) private readonly timetable: ITimetableService
  ) { super() }

  async generate(request: Request): Promise<Response> {
    const schedule = await this.timetable.generateSchedule({
      term: request.input('term'),
      constraints: request.input('constraints')
    })
    return this.view('Pages/Schedule', { schedule })
  }
}

// 3. In routes/web.ts:
router.post('/schedule/generate', [TimetableController, 'generate'])

// 4. In ServiceProvider — the ONLY place that knows it's a remote service:
this.app.singleton(ITimetableService, () => {
  return this.app.make(MicroserviceManager).resolve<ITimetableService>('timetable')
})

// 5. In tests — mock the interface, never the transport:
app.instance(ITimetableService, new MockTimetableService())
```

### 5.2 Transport Comparison Matrix

| Transport | Latency | Throughput | Streaming | Language Support | Best For |
|-----------|---------|-----------|-----------|-----------------|---------|
| Unix Socket | <100μs | Very High | Yes | Any (POSIX) | Same-host sidecar services |
| Shared Memory | <10μs | Extreme | Yes | C/C++/Rust/Go | Ultra-low latency, same host |
| gRPC | 1-5ms | High | Yes (4 modes) | All major languages | Standard inter-service calls |
| NATS | 1-3ms | Very High | Yes | All major languages | Event-driven, pub/sub patterns |
| Kafka | 5-20ms | Extreme | Yes | All major languages | Durable event streaming |
| HTTP/REST | 5-50ms | Medium | SSE/WebSocket | Universal | Simple, public-facing APIs |

### 5.3 Service Contract Versioning Protocol

```
Semantic versioning for service contracts:
  v1.0.0 → v1.1.0: MINOR — added optional fields (non-breaking)
  v1.0.0 → v2.0.0: MAJOR — removed/renamed fields (breaking)

Compatibility matrix enforced at runtime:
  Client v1.x ↔ Server v1.y: COMPATIBLE (same major)
  Client v1.x ↔ Server v2.y: WARNING in dev, ERROR in production

carpenter service:check:
  Compares two schema versions, outputs:
    ✅ COMPATIBLE: Added optional field 'duration' to Session
    ❌ BREAKING: Removed required field 'constraints' from GenerateScheduleRequest
    ❌ BREAKING: Changed type of 'term' from string to TermEnum
```

---

## 6. Edge Computing Specification

### 6.1 Runtime Capability Matrix

| Capability | Bun | Node | CF Workers | Vercel Edge | Deno Deploy |
|-----------|-----|------|-----------|------------|------------|
| Filesystem | ✅ | ✅ | ❌ | ❌ | Limited |
| TCP Sockets | ✅ | ✅ | Limited | ❌ | ✅ |
| Long-running | ✅ | ✅ | ❌ (CPU limit) | ❌ | ✅ |
| HTTP/3 | ✅ | Via lib | ✅ | ✅ | ✅ |
| KV Store | Via Redis | Via Redis | CF KV | Vercel KV | Deno KV |
| Object Store | Via S3 | Via S3 | CF R2 | Vercel Blob | S3 |
| SQL Database | Direct | Direct | CF D1 | PlanetScale HTTP | Via HTTP |
| WebSockets | ✅ | ✅ | CF Durable Objects | Limited | ✅ |
| Cron / Scheduler | Process-based | Process-based | CF Cron Triggers | Vercel Cron | Deno Cron |

### 6.2 Edge Bundle Size Targets

```
Carpenter Edge Bundle (CF Workers):
  Target: < 1MB compressed (CF Workers hard limit: 10MB, target: 10% of limit)

  What's included in edge bundle:
    ✅ HTTP router
    ✅ Middleware pipeline
    ✅ Validation (no DB rules)
    ✅ JWT auth
    ✅ CarpenterUI SSR runtime
    ✅ Edge cache adapter
    ✅ Edge storage adapter

  What's excluded (not edge-compatible):
    ❌ ORM (replaced by edge DB adapter with SQL-over-HTTP)
    ❌ Queue worker (replaced by edge queue triggers)
    ❌ Nodemailer (replaced by HTTP mail adapters: Resend/Mailgun)
    ❌ File session store (replaced by cookie session)
```

---

## 7. AI/ML Integration Specification

### 7.1 AI Provider Cost Estimation

```typescript
// Cost tracking built into every AI call
const result = await AI.complete({ model: 'claude-opus-4-5', messages })
console.log(result.usage)
// {
//   promptTokens: 1250,
//   completionTokens: 380,
//   totalTokens: 1630,
//   estimatedCostUsd: 0.024,  // based on current pricing from config
//   provider: 'anthropic',
//   model: 'claude-opus-4-5'
// }

// Aggregate cost per request tracked in OTel span
// Daily/monthly cost reports via CarpenterAdmin AI metrics panel
```

### 7.2 AI Safety Guardrails (Layered Defence)

```
Layer 1 — Input Validation:
  - Max prompt length enforcement
  - Prompt injection pattern detection
  - PII detection in user input (configurable: warn | block)

Layer 2 — Provider Level:
  - System prompt: always includes safety instructions
  - Temperature limits: max temperature configurable per use case
  - Moderation API call on sensitive content categories

Layer 3 — Output Validation:
  - AiGuardMiddleware: scans output for PII before sending to client
  - Toxicity filter: optional moderation API call on output
  - Structured output schema validation (AI.structured<T>)
  - Output length limits: prevent runaway responses

Layer 4 — Observability:
  - Full audit log: every AI interaction logged
  - Anomaly detection: unusual usage patterns trigger alerts
  - Cost circuit breaker: halt AI calls if daily spend exceeds threshold
```

---

## 8. Security Threat Model

### 8.1 OWASP Top 10 (2021) Response Matrix

| OWASP | Risk | Carpenter Defence | Implementation |
|-------|------|------------------|----------------|
| A01 Broken Access Control | Critical | Gate + Policy system; route-level @Auth; resource authorization in admin | `AuthMiddleware`, `Gate`, `BasePolicy` |
| A02 Cryptographic Failures | Critical | AES-256-GCM encryption; argon2/bcrypt hashing; TLS enforced; secrets in env | `Encrypter`, `HashManager`, `EncryptCookies` |
| A03 Injection | Critical | Parameterized queries always; dangerouslyRaw() explicit; HTML escaping in templates | `QueryBuilder`, `CarpenterUI` auto-escaping |
| A04 Insecure Design | High | SOLID principles; threat modeling in this spec; security review in DoD | Architecture decisions + code review checklist |
| A05 Security Misconfiguration | High | Secure defaults; carpenter doctor; CSP; SecureHeaders | `SecureHeaders`, `carpenter doctor`, `CspMiddleware` |
| A06 Vulnerable Components | High | npm audit gate; SBOM; minimal deps; allowlist | CI pipeline + `carpenter sbom` |
| A07 Auth Failures | Critical | timingSafeEqual; session regeneration; account lockout; rate limiting auth | `SessionGuard`, `ThrottleRequests`, auth middleware |
| A08 Data Integrity Failures | High | SRI; deserialization protection; signed JWTs | SRI in HTML builder, `JwtGuard`, serialization safety |
| A09 Logging Failures | Medium | Structured logging; audit log; PII redaction; log injection prevention | `Logger`, `AuditLog`, redaction rules |
| A10 SSRF | High | HttpClient SSRF protection; private IP blocklist; URL allowlist | `HttpClient` with SSRF guard |

### 8.2 Security Incident Response

```
carpenter security:scan --full:
  1. Runs npm audit
  2. Scans for hardcoded secrets
  3. Checks TLS configuration
  4. Validates CSP headers
  5. Checks authentication middleware on all routes
  6. Reports: summary with critical/high/medium/low counts

Responsible disclosure: SECURITY.md with GPG key for encrypted reports
CVE tracking: GitHub Security Advisories for all @carpentry/* packages
Patch SLA: Critical = 24h, High = 72h, Medium = 2 weeks
```

---

## 9. Observability Specification

### 9.1 The Three Pillars

```
TRACES  → Where did time go? Distributed across services?
METRICS → Is the system healthy right now? Trending well over time?
LOGS    → What exactly happened? What was the state?

All three correlated by: traceId + requestId + userId + tenantId
All three shipped to same backend (Grafana Stack: Tempo + Prometheus + Loki)
```

### 9.2 Built-in Dashboards

```
Carpenter ships Grafana dashboard JSON configs (import with one click):

1. Overview Dashboard:
   - RPS, error rate, p50/p95/p99 latency (last 24h)
   - Active requests, active DB connections
   - Cache hit rate, queue depth

2. Database Dashboard:
   - Query rate by table/type, slow query histogram
   - Connection pool utilization, wait time
   - Migration status, last run time

3. AI Dashboard:
   - Tokens consumed per model per day, estimated cost
   - Request rate, error rate, latency per provider
   - RAG pipeline: query latency, embedding cache hit rate

4. Queue Dashboard:
   - Jobs processed/failed per queue, retry rate
   - Queue depth over time, worker utilization
   - Failed job reasons pie chart

5. Security Dashboard:
   - Auth failures per IP, brute force detection
   - CSP violation reports, rate limit hits
   - Anomalous AI usage alerts
```

---

## 10. Extended Monorepo Structure

```
carpenter/
├── packages/ (from Part I)
│   └── ... (all 22 original packages, including @carpentry/faker and @carpentry/padlock)
│
├── packages/ (new in Part II)
│   ├── bridge/                  # @carpentry/bridge (polyglot microservices core)
│   │   ├── src/
│   │   │   ├── manager/         # MicroserviceManager
│   │   │   ├── proxy/           # TypedServiceProxy (ES Proxy)
│   │   │   ├── discovery/       # IServiceDiscovery + adapters
│   │   │   └── contracts/       # ITransportAdapter, IRemoteService
│   │   └── tests/
│   │
│   ├── bridge-grpc/             # @carpentry/bridge-grpc
│   ├── bridge-nats/             # @carpentry/bridge-nats
│   ├── bridge-kafka/            # @carpentry/bridge-kafka
│   │
│   ├── edge/                    # @carpentry/edge
│   │   ├── src/
│   │   │   ├── runtime/         # EdgeBootstrap, runtime detection
│   │   │   ├── adapters/        # All edge-specific adapter implementations
│   │   │   └── build/           # Edge build target plugins
│   │   └── tests/
│   │
│   ├── ai/                      # @carpentry/ai
│   │   ├── src/
│   │   │   ├── providers/       # IAIProvider + all implementations
│   │   │   ├── agent/           # Agent, @AiTool, memory
│   │   │   ├── rag/             # RAG pipelines, vector stores, document loaders
│   │   │   ├── mcp/             # MCPClient + MCPServer
│   │   │   └── guard/           # AiGuardMiddleware
│   │   └── tests/
│   │
│   ├── graphql/                 # @carpentry/graphql
│   ├── graphql-federation/      # @carpentry/graphql-federation
│   │
│   ├── otel/                    # @carpentry/otel
│   │   ├── src/
│   │   │   ├── tracing/         # Trace instrumentation hooks
│   │   │   ├── metrics/         # Metric collectors + Prometheus exporter
│   │   │   └── logging/         # Structured logger + adapters
│   │   └── tests/
│   │
│   ├── multitenancy/            # @carpentry/multitenancy
│   │   ├── src/
│   │   │   ├── resolver/        # Tenant resolution strategies
│   │   │   ├── context/         # TenantContext (AsyncLocalStorage)
│   │   │   ├── isolation/       # DB/Cache/Storage isolation adapters
│   │   │   └── manager/         # TenantManager, provisioning pipeline
│   │   └── tests/
│   │
│   ├── admin/                   # @carpentry/admin
│   │   ├── src/
│   │   │   ├── resources/       # BaseAdminResource, field types
│   │   │   ├── actions/         # BaseAdminAction
│   │   │   ├── filters/         # BaseAdminFilter
│   │   │   ├── dashboard/       # AdminDashboard, metric cards
│   │   │   └── pages/           # CarpenterUI .carp pages for admin
│   │   └── tests/
│   │
│   ├── wasm/                    # @carpentry/wasm
│   │
│   ├── flags/                   # @carpentry/flags
│   │   ├── src/
│   │   │   ├── manager/         # FlagManager
│   │   │   ├── providers/       # Local, Database, LaunchDarkly, Unleash, GrowthBook
│   │   │   └── experiment/      # A/B testing, variant tracking
│   │   └── tests/
│   │
│   ├── realtime/                # @carpentry/realtime
│   │   ├── src/
│   │   │   ├── presence/        # PresenceChannel
│   │   │   └── crdt/            # CollaborativeDoc (Yjs integration)
│   │   └── tests/
│   │
│   ├── broadcasting/            # @carpentry/broadcasting (channel-based pub/sub)
│   │   ├── src/
│   │   │   ├── manager/         # BroadcastManager (Log, Null, Pusher, Soketi, Ably)
│   │   │   └── channels/        # Channel, PresenceChannel
│   │   └── tests/
│   │
│   ├── search/                  # @carpentry/search (full-text search)
│   │   ├── src/
│   │   │   └── manager/         # SearchManager (database, Meilisearch, Typesense, Algolia)
│   │   └── tests/
│   │
│   ├── audit/                   # @carpentry/audit (audit logging)
│   │   ├── src/
│   │   │   └── manager/         # AuditManager (database, file, with change tracking)
│   │   └── tests/
│   │
│   ├── webhook/                 # @carpentry/webhook (webhook receiving & verification)
│   │   ├── src/
│   │   │   └── receiver/        # WebhookReceiver (Stripe, GitHub, Shopify, custom)
│   │   └── tests/
│   │
│   ├── health/                  # @carpentry/health (health check probes)
│   │   ├── src/
│   │   │   ├── checker/         # HealthChecker (composite aggregator)
│   │   │   └── checks/          # Database, Cache, Memory, Disk built-in checks
│   │   └── tests/
│   │
│   ├── encrypt/                 # @carpentry/encrypt (field-level AES-256-GCM, tier-1 private)
│   │   ├── src/
│   │   │   └── aes/             # AesEncrypter (Node.js crypto, zero external deps)
│   │   └── tests/
│   │
│   ├── chaos/                   # @carpentry/chaos (non-prod only)
│   ├── ts-plugin/               # @carpentry/ts-plugin (Language Service Plugin)
│   └── vscode/                  # @carpentry/vscode (VS Code extension)
│
├── examples/ (Part I + new)
│   ├── blog-app/
│   ├── api-only/
│   ├── fullstack-react/
│   ├── polyglot-timetable/      # NEW: Carpenter + Rust + Go services
│   ├── saas-starter/            # NEW: Multi-tenant SaaS with admin panel
│   ├── ai-assistant/            # NEW: Streaming AI chat with RAG
│   └── edge-app/                # NEW: CF Workers deployment
│
├── benchmarks/                  # Benchmark suite + historical results
├── security/                    # Security audit reports, SBOM, CVE history
└── infra/
    ├── docker-compose.yml       # Full dev stack: Postgres, Redis, NATS, Kafka, Jaeger
    ├── k8s/                     # Example Kubernetes manifests
    └── grafana/                 # Pre-built dashboard JSON configs
```

---

## Appendix A — Complete Sprint Velocity Summary (Parts I + II)

| Sprint | Focus | Points |
|--------|-------|--------|
| 1 | Monorepo + IoC Container | 31 |
| 2 | App Kernel + HTTP Basics | 29 |
| 3 | Router + HTTP Kernel | 23 |
| 4 | ORM Core (QueryBuilder + Model) | 26 |
| 5 | ORM Relations + Migrations + Seeders | 26 |
| 6 | Database Adapters | 19 |
| 7 | Cache + Queue + Mail | 29 |
| 8 | Storage + Auth + Validation | 34 |
| 9 | Events + Collections + Utilities | 21 |
| 10 | CarpenterUI VDOM + Compiler | 26 |
| 11 | CarpenterUI Reactivity + SSR + Router | 21 |
| 12 | UI Bridge (Web Routes → UI) | 18 |
| 13 | Pluggable UI Adapters | 21 |
| 14 | Testing Infrastructure | 26 |
| 15 | CLI Toolchain | 18 |
| 16 | Resilience Patterns | 13 |
| 17 | Advanced ORM + Route Throttling | 13 |
| 18 | Scheduler + Notifications + Broadcasting | 24 |
| 19 | Security + Performance + Hardening | 18 |
| 20 | Docs + Examples + Release (Phase 1) | 21 |
| 21 | Polyglot Bridge Transport Layer | 24 |
| 22 | CSDL, Discovery, Rust Example | 23 |
| 23 | Edge Computing Runtime | 16 |
| 24 | AI Core: Provider, Streaming, RAG | 21 |
| 25 | AI Agents, MCP, Guard Middleware | 21 |
| 26 | GraphQL Core + Federation | 16 |
| 27 | OpenTelemetry Traces + Metrics + Logging | 16 |
| 28 | Multi-tenancy System | 21 |
| 29 | CarpenterAdmin Panel | 21 |
| 30 | WASM + Advanced Security | 16 |
| 31 | Feature Flags + Experimentation | 8 |
| 32 | Real-time Collaboration | 13 |
| 33 | DX Tooling: TS Plugin + HMR | 16 |
| 34 | HTTP/3 + Islands Architecture | 16 |
| 35 | Performance Benchmarks + Chaos | 16 |
| 36 | Cross-Package Integration Testing | 40 |
| 37 | Security Audit + Pen Testing | 35 |
| 38 | Documentation + Migration Guides | 40 |
| 39 | Plugin System + Community | 30 |
| 40 | Final Polish + v1.0 GA Release | 25 |
| 41 | Broadcasting, Search, Health, Audit, Webhooks, Encryption & Extended Adapters | 36 |
| **TOTAL** | | **~936 points across 145 stories** |

---

## Appendix B — The Carpenter Manifesto

> For AI agents executing this plan:

**Carpenter exists because every framework forces a choice:**
- Performance OR developer experience
- Type safety OR ecosystem size
- Infrastructure flexibility OR convention
- Full-stack OR API-only
- Server-rendered OR SPA
- Single language OR polyglot

**Carpenter refuses all these trade-offs.**

It is built on the conviction that a sufficiently well-designed architecture — one that applies SOLID principles rigorously, embraces the adapter pattern everywhere, and invests in first-class abstractions — can deliver ALL of these things simultaneously.

**Rules for every AI agent building Carpenter:**

1. If you're writing `new ConcreteClass()` outside a ServiceProvider — you're doing it wrong.
2. If you're writing `any` — you're doing it wrong.
3. If you're writing a test that hits a real database — you're doing it wrong.
4. If a class has more than one reason to change — split it.
5. If two files have similar code — extract a shared abstraction.
6. If a function is longer than 40 lines — extract private methods.
7. If an interface has more than 7 methods — split it (ISP).
8. If you're catching an error and doing nothing — that's a bug.
9. If it works but isn't simple — simplify it (KISS).
10. If the developer has to know which transport a remote service uses — that's a Carpenter bug.

**The north star:** A Carpenter app should look nearly identical whether it runs on Bun locally, deploys to Kubernetes, serves from a Cloudflare edge node, uses PostgreSQL or SQLite, calls TypeScript services or Rust binaries, renders with CarpenterUI or React, or uses OpenAI or Anthropic. The infrastructure is a detail. The application is the thing that matters.

---

*Carpenter Framework SCRUM Plan v1.0.0 — Parts I + II*  
*145 Stories · 42 Sprints · ~936 Story Points*  
*License: MIT | Runtime: Bun ≥1.1 / Node.js ≥20 | Language: TypeScript 5.x*
