# 🪚 Carpenter Framework — Agile SCRUM Project Plan

> **Version:** 1.0.0-plan  
> **Runtime:** Bun (primary) / Node.js (compatible)  
> **Language:** TypeScript (strict mode)  
> **Paradigm:** Full-Stack, Infrastructure-Agnostic, Laravel-Inspired  
> **Author:** AI Build Specification — For Codex / Claude Execution  

---

## Table of Contents

1. [Project Vision & Goals](#1-project-vision--goals)
2. [Architecture Overview](#2-architecture-overview)
3. [Design Principles & Pattern Contracts](#3-design-principles--pattern-contracts)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Epics](#5-epics)
6. [Sprint Plan (20 Sprints)](#6-sprint-plan)
7. [Definition of Done](#7-definition-of-done)
8. [Testing Strategy](#8-testing-strategy)
9. [IoC Container Specification](#9-ioc-container-specification)
10. [Routing Specification](#10-routing-specification)
11. [Frontend Engine Specification](#11-frontend-engine-specification)
12. [Infrastructure Adapters Specification](#12-infrastructure-adapters-specification)
13. [Acceptance Criteria Per Epic](#13-acceptance-criteria-per-epic)

---

## 1. Project Vision & Goals

### Vision Statement

Carpenter Framework is a **Laravel-inspired, full-stack TypeScript framework** that runs on Bun or Node.js, providing a familiar, expressive developer experience while remaining **completely infrastructure-agnostic**. It provides a first-class frontend engine (CarpenterUI) while allowing drop-in replacement with React, Vue, Solid, Svelte, or any other UI layer. Web routes are directly accessible to the UI layer (like Inertia.js/Livewire), and API routes remain available for decoupled consumers.

### Core Goals

| # | Goal | Priority |
|---|------|----------|
| G1 | Laravel-like DX (routing, ORM, controllers, middleware, services) in TypeScript | Must Have |
| G2 | Infrastructure-agnostic via adapter pattern (DB, Cache, Queue, Mail, Storage) | Must Have |
| G3 | Full IoC/DI container with auto-wiring, scoped bindings, and decorators | Must Have |
| G4 | Dual routing: Web routes with direct UI access + REST/GraphQL API routes | Must Have |
| G5 | CarpenterUI — first-class reactive frontend with SSR/SSG/CSR | Must Have |
| G6 | Pluggable UI: React, Vue, Svelte, Solid via official adapter packages | Must Have |
| G7 | Full OOP: abstract base classes, traits (mixins), interfaces, generics | Must Have |
| G8 | 100% test coverage infrastructure: unit, integration, e2e, mocks for all adapters | Must Have |
| G9 | CLI toolchain (`carpenter` CLI) for scaffolding, migrations, jobs, and more | Must Have |
| G10 | GoF design patterns applied consistently and explicitly throughout | Must Have |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CARPENTER FRAMEWORK                       │
│                                                                  │
│  ┌─────────────┐    ┌──────────────────────────────────────┐   │
│  │  carpenter  │    │           HTTP KERNEL                 │   │
│  │    CLI      │    │  ┌──────────────┐ ┌───────────────┐  │   │
│  │  (scaffold, │    │  │  Web Router  │ │  API Router   │  │   │
│  │   migrate,  │    │  │  (+ UI SSR)  │ │ (REST/Graph)  │  │   │
│  │   generate) │    │  └──────┬───────┘ └───────┬───────┘  │   │
│  └─────────────┘    │         │                 │           │   │
│                     │  ┌──────▼─────────────────▼───────┐  │   │
│                     │  │       Middleware Pipeline        │  │   │
│                     │  └──────────────┬──────────────────┘  │   │
│                     │                 │                      │   │
│                     │  ┌──────────────▼──────────────────┐  │   │
│                     │  │         IoC Container            │  │   │
│                     │  │  (Bindings, Singletons, Scopes)  │  │   │
│                     │  └──────────────┬──────────────────┘  │   │
│                     └─────────────────┼────────────────────-┘   │
│                                       │                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    APPLICATION LAYER                      │   │
│  │  Controllers │ Services │ Repositories │ Jobs │ Events   │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │                 INFRASTRUCTURE ADAPTERS                   │   │
│  │                                                           │   │
│  │  ┌──────────┐ ┌───────┐ ┌───────┐ ┌──────┐ ┌────────┐  │   │
│  │  │ Database │ │ Cache │ │ Queue │ │ Mail │ │Storage │  │   │
│  │  │ Adapter  │ │Adapter│ │Adapter│ │Adapt.│ │Adapter │  │   │
│  │  └────┬─────┘ └───┬───┘ └───┬───┘ └──┬───┘ └────┬───┘  │   │
│  │       │           │         │         │           │       │   │
│  │  Postgres   Redis/Mem   Bull/BullMQ  SMTP/SES  S3/Local  │   │
│  │  MySQL      Valkey      RabbitMQ     Mailgun   GCS/Azure  │   │
│  │  SQLite     Dragonfly   SQS          Resend    Cloudinary │   │
│  │  MongoDB    Upstash     (any)        (any)     (any)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     FRONTEND LAYER                        │   │
│  │                                                           │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐  │   │
│  │  │  CarpenterUI    │    │  UI Adapters (pluggable)     │  │   │
│  │  │  (default SSR)  │    │  React / Vue / Svelte/Solid  │  │   │
│  │  └─────────────────┘    └─────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun ≥1.1 (primary), Node.js ≥20 (compatible) |
| Language | TypeScript 5.x (strict, decorators enabled) |
| HTTP Server | Bun.serve / Hono (abstracted behind `HttpServer` interface) |
| ORM Core | Custom `CarpenterORM` (query builder + active record, adapter-based) |
| Frontend Engine | CarpenterUI (custom VDOM + SSR, `.carp` SFC files) |
| Test Runner | Bun test / Vitest |
| CLI | `commander.js` + `inquirer` bundled into `carpenter` binary |
| Build | Bun bundler / tsup |
| Linting | ESLint (typescript-eslint) + Prettier |
| DI Decorators | `reflect-metadata` + custom `tsyringe`-style IoC |

---

## 2. Architecture Overview

### Layered Architecture (Onion/Clean)

```
[ Presentation Layer ]   → Controllers, Views, CarpenterUI Pages
[ Application Layer ]    → Services, Use Cases, DTOs, Form Requests
[ Domain Layer ]         → Models, Entities, Repositories (interfaces), Domain Events
[ Infrastructure Layer ] → Adapter implementations (DB, Cache, Queue, etc.)
[ Framework Core ]       → IoC, Router, Middleware, Kernel, CLI
```

---

## 3. Design Principles & Pattern Contracts

> **AI INSTRUCTION:** Every generated file MUST include a JSDoc comment block identifying which principles and patterns it implements. Violations are build failures.

### 3.1 SOLID Enforcement Rules

```typescript
/**
 * SOLID Compliance Contract — enforced per file.
 *
 * SRP  : This class has ONE reason to change. If it has more, split it.
 * OCP  : Extend via interfaces/abstract classes. Never modify a concrete class to add behaviour.
 * LSP  : All implementations of an interface must be fully substitutable.
 * ISP  : No interface has more than 5–7 methods. Split large interfaces.
 * DIP  : Constructors accept INTERFACES, not concrete classes. Bindings live in ServiceProviders.
 */
```

### 3.2 DRY Contract

- **Zero duplicated logic.** Every shared behaviour lives in a base class, mixin, utility, or service.
- Shared validation → `Validator` service.
- Shared transformation → `Transformer` / `Pipeline`.
- Shared query fragments → query scopes on models.

### 3.3 KISS Contract

- No class exceeds 300 lines. Refactor if it does.
- No function exceeds 40 lines. Extract if it does.
- No nesting deeper than 3 levels. Use early returns / guard clauses.

### 3.4 GoF Pattern Registry

Each pattern below maps to a specific Carpenter module. AI must implement these **exactly**.

| Pattern | Category | Carpenter Module |
|---------|----------|-----------------|
| **Factory Method** | Creational | `AdapterFactory`, `ModelFactory` (seeders) |
| **Abstract Factory** | Creational | `DatabaseManager` (driver factories), `CacheAdapterFactory` |
| **Builder** | Creational | `QueryBuilder`, `RouteBuilder`, `MailBuilder` |
| **Singleton** | Creational | IoC singleton bindings, `Application` instance |
| **Prototype** | Creational | `Model.replicate()` |
| **Adapter** | Structural | All infrastructure adapters (DB, Cache, Queue, Mail) |
| **Bridge** | Structural | `DatabaseManager` bridging drivers to ORM |
| **Composite** | Structural | `MiddlewarePipeline`, `RouteGroup` |
| **Decorator** | Structural | Middleware stack, `@Injectable`, `@Validate` decorators |
| **Facade** | Structural | `DB`, `Cache`, `Queue`, `Mail`, `Storage` facades |
| **Flyweight** | Structural | Connection pooling in DB adapters |
| **Proxy** | Structural | Lazy model loading, `ModelProxy` |
| **Chain of Responsibility** | Behavioral | `MiddlewarePipeline`, `ExceptionHandler` chain |
| **Command** | Behavioral | `Job` / queue system, CLI commands |
| **Iterator** | Behavioral | `Collection<T>`, paginator cursors |
| **Mediator** | Behavioral | `EventDispatcher` |
| **Memento** | Behavioral | Model `getOriginal()` / dirty tracking |
| **Observer** | Behavioral | `Model` events, `EventEmitter`, hooks |
| **State** | Behavioral | Request lifecycle states |
| **Strategy** | Behavioral | Auth strategies, hashing strategies, pagination strategies |
| **Template Method** | Behavioral | `BaseController`, `BaseSeeder`, `BaseMigration`, `BaseJob` |
| **Visitor** | Behavioral | Query AST traversal in ORM |

### 3.5 Modularity / Separation of Concerns

- One class per file.
- Barrel `index.ts` exports per package only — no cross-package barrel hell.
- Package boundaries enforced by TypeScript project references.

### 3.6 Graceful Degradation

- Every I/O operation wrapped in `Result<T, CarpenterError>` type.
- No raw `throw` in service/repository layer — use `Result` or typed errors.
- Circuit breaker pattern available in `@formwork/resilience` package.

---

## 4. Monorepo Structure

```
carpenter/
├── packages/
│   ├── core/                    # @formwork/core
│   │   ├── src/
│   │   │   ├── application/     # Application bootstrap & kernel
│   │   │   ├── container/       # IoC container
│   │   │   ├── config/          # Config loader & manager
│   │   │   ├── env/             # .env parser & typed env
│   │   │   ├── exceptions/      # Base exceptions & handler
│   │   │   ├── pipeline/        # Pipeline / middleware abstraction
│   │   │   ├── support/         # Helpers, Collection, Str, Arr, Carbon
│   │   │   └── contracts/       # All framework interfaces (ISP-split)
│   │   └── tests/
│   │
│   ├── http/                    # @formwork/http
│   │   ├── src/
│   │   │   ├── kernel/          # HttpKernel
│   │   │   ├── router/          # Web + API router
│   │   │   ├── request/         # Request object
│   │   │   ├── response/        # Response object, JsonResponse
│   │   │   ├── middleware/       # Built-in middleware
│   │   │   ├── controller/      # BaseController
│   │   │   └── session/         # Session manager + adapters
│   │   └── tests/
│   │
│   ├── orm/                     # @formwork/orm
│   │   ├── src/
│   │   │   ├── model/           # BaseModel, ActiveRecord
│   │   │   ├── query/           # QueryBuilder, Grammar, AST
│   │   │   ├── relations/       # HasOne, HasMany, BelongsTo, etc.
│   │   │   ├── migrations/      # Migration runner & base class
│   │   │   ├── seeders/         # BaseSeeder & ModelFactory
│   │   │   ├── scopes/          # Global & local query scopes
│   │   │   └── adapters/        # DB adapter contracts + manager
│   │   └── tests/
│   │
│   ├── faker/                   # @formwork/faker
│   │   ├── src/
│   │   │   ├── manager/         # FakerManager + fake() helper
│   │   │   ├── providers/       # Person, company, commerce, internet, finance
│   │   │   ├── presets/         # Locale packs, seeds, deterministic profiles
│   │   │   └── testing/         # Unique pools, sequences, scenario builders
│   │   └── tests/
│   │
│   ├── db-adapters/             # @formwork/db-adapters
│   │   ├── postgres/            # @formwork/db-postgres
│   │   ├── mysql/               # @formwork/db-mysql
│   │   ├── sqlite/              # @formwork/db-sqlite
│   │   └── mongodb/             # @formwork/db-mongodb
│   │
│   ├── cache/                   # @formwork/cache
│   │   ├── src/
│   │   │   ├── manager/         # CacheManager
│   │   │   ├── contracts/       # CacheStore interface
│   │   │   └── adapters/        # Redis, Memory, File, Null
│   │   └── tests/
│   │
│   ├── queue/                   # @formwork/queue
│   │   ├── src/
│   │   │   ├── manager/         # QueueManager
│   │   │   ├── worker/          # Queue worker process
│   │   │   ├── job/             # BaseJob, ShouldQueue
│   │   │   └── adapters/        # BullMQ, SQS, Database, Sync
│   │   └── tests/
│   │
│   ├── mail/                    # @formwork/mail
│   │   ├── src/
│   │   │   ├── manager/         # MailManager
│   │   │   ├── mailable/        # BaseMailable, MailBuilder
│   │   │   └── adapters/        # SMTP, SES, Mailgun, Resend, Log, Array
│   │   └── tests/
│   │
│   ├── storage/                 # @formwork/storage
│   │   ├── src/
│   │   │   ├── manager/         # StorageManager
│   │   │   └── adapters/        # Local, S3, GCS, Azure
│   │   └── tests/
│   │
│   ├── auth/                    # @formwork/auth
│   │   ├── src/
│   │   │   ├── guards/          # Session, JWT, API Token guards
│   │   │   ├── providers/       # EloquentProvider, etc.
│   │   │   ├── middleware/      # Auth, Guest, Throttle
│   │   │   └── policies/        # BasePolicy, Gate
│   │   └── tests/
│   │
│   ├── padlock/                 # @formwork/padlock
│   │   ├── src/
│   │   │   ├── services/        # Register, login, reset-password, verify-email flows
│   │   │   ├── http/            # Controllers, DTOs, route registration
│   │   │   ├── twofactor/       # TOTP, recovery codes, challenge workflow
│   │   │   ├── lockout/         # Attempt throttling and lockout stores
│   │   │   ├── notifiers/       # Mail/SMS/in-app notification adapters + fakes
│   │   │   └── testing/         # In-memory repositories, token stores, test helpers
│   │   └── tests/
│   │
│   ├── validation/              # @formwork/validation
│   │   ├── src/
│   │   │   ├── validator/       # Validator
│   │   │   ├── rules/           # Built-in rules
│   │   │   ├── form-request/    # BaseFormRequest
│   │   │   └── contracts/
│   │   └── tests/
│   │
│   ├── events/                  # @formwork/events
│   │   ├── src/
│   │   │   ├── dispatcher/      # EventDispatcher (Mediator)
│   │   │   ├── listener/        # BaseListener
│   │   │   └── subscriber/      # EventSubscriber
│   │   └── tests/
│   │
│   ├── ui/                      # @formwork/ui (CarpenterUI engine)
│   │   ├── src/
│   │   │   ├── vdom/            # Virtual DOM implementation
│   │   │   ├── compiler/        # .carp SFC compiler
│   │   │   ├── runtime/         # Client-side runtime
│   │   │   ├── ssr/             # Server-side renderer
│   │   │   ├── router/          # Client-side router
│   │   │   ├── store/           # Reactive state (Signals-based)
│   │   │   └── bridge/          # Web route ↔ UI bridge (Inertia-style)
│   │   └── tests/
│   │
│   ├── ui-adapters/             # @formwork/ui-adapters
│   │   ├── react/               # @formwork/ui-react
│   │   ├── vue/                 # @formwork/ui-vue
│   │   ├── svelte/              # @formwork/ui-svelte
│   │   └── solid/               # @formwork/ui-solid
│   │
│   ├── testing/                 # @formwork/testing
│   │   ├── src/
│   │   │   ├── application/     # TestApplication bootstrap
│   │   │   ├── http/            # TestHttpClient
│   │   │   ├── mocks/           # All infrastructure mocks
│   │   │   │   ├── MockDatabase
│   │   │   │   ├── MockCache
│   │   │   │   ├── MockQueue
│   │   │   │   ├── MockMail
│   │   │   │   └── MockStorage
│   │   │   ├── factories/       # Model factories
│   │   │   └── traits/          # DatabaseTransactions, RefreshDatabase
│   │   └── tests/
│   │
│   ├── resilience/              # @formwork/resilience
│   │   ├── src/
│   │   │   ├── circuit-breaker/
│   │   │   ├── retry/
│   │   │   └── rate-limiter/
│   │   └── tests/
│   │
│   └── cli/                     # @formwork/cli
│       ├── src/
│       │   ├── commands/        # All carpenter CLI commands
│       │   └── stubs/           # File generation templates
│       └── tests/
│
├── create-carpenter-app/        # npx create-carpenter-app
├── docs/                        # Documentation site
├── examples/
│   ├── blog-app/
│   ├── api-only/
│   └── fullstack-react/
├── biome.json                   # Linter/formatter config
├── turbo.json                   # Turborepo pipeline
├── package.json                 # Workspace root
└── tsconfig.base.json           # Base TS config
```

Package layout invariant:
- Every workspace package keeps canonical implementation source in `src/` and tests in `tests/`.
- `dist/` is generated output only and must never be treated as a hidden source-of-truth package.

---

## 5. Epics

| Epic ID | Name | Description |
|---------|------|-------------|
| E01 | Monorepo & Toolchain Setup | Workspace, TypeScript config, CI/CD, linting pipeline |
| E02 | IoC Container | Full DI container with decorators, scoping, auto-wiring |
| E03 | Application Kernel & Bootstrap | App lifecycle, service providers, config, env |
| E04 | HTTP Layer | Request/Response, routing (web+api), middleware pipeline |
| E05 | ORM & Query Builder | Model, relations, query builder, migrations, seeders, factories, faker integration |
| E06 | Database Adapters | Postgres, MySQL, SQLite, MongoDB adapters |
| E07 | Cache System | CacheManager + Redis, Memory, File, Null adapters |
| E08 | Queue System | QueueManager + BullMQ, SQS, Sync, Database adapters |
| E09 | Mail System | MailManager + SMTP, SES, Mailgun, Resend, Log adapters |
| E10 | Storage System | StorageManager + Local, S3, GCS, Azure adapters |
| E11 | Auth & Authorization | Guards, providers, middleware, policies, Gate, Padlock auth workflows |
| E12 | Validation System | Validator, rules, FormRequest, custom rules |
| E13 | Events System | EventDispatcher, listeners, subscribers, async events |
| E14 | CarpenterUI Engine | VDOM, .carp compiler, SSR, client runtime, store |
| E15 | UI Bridge (Web Routes→UI) | Inertia-style page props bridge, shared data, flash |
| E16 | Pluggable UI Adapters | React, Vue, Svelte, Solid adapter packages |
| E17 | Testing Infrastructure | TestApp, mocks, factories, faker, HTTP client, test traits |
| E18 | CLI Toolchain | `carpenter` CLI with all generators and commands |
| E19 | Resilience Patterns | Circuit breaker, retry, rate limiter |
| E20 | Docs, Examples & Release | Documentation, example apps, NPM publish |

---

## 6. Sprint Plan

> **Sprint Duration:** 2 weeks  
> **Velocity Target:** 40 story points per sprint  
> **Story Point Scale:** Fibonacci (1, 2, 3, 5, 8, 13)

---

### Sprint 1 — Monorepo Foundation & IoC Container (E01 + E02 partial)

**Sprint Goal:** A working monorepo with TypeScript project references, build pipeline, and a fully tested IoC container.

#### Stories

---

**CARP-001** `[E01]` Initialize Monorepo Structure  
**Points:** 3 | **Priority:** Critical

```
As a framework developer,
I want a Turborepo-based monorepo with Bun workspaces
So that all packages share TypeScript config and can be built/tested independently.

Acceptance Criteria:
- [ ] Root package.json with bun workspaces configured
- [ ] turbo.json with build, test, lint pipelines
- [ ] tsconfig.base.json with strict: true, decorators: true, experimentalDecorators: true
- [ ] Each package has tsconfig.json extending base with project references
- [ ] biome.json configured for formatting + linting
- [ ] GitHub Actions CI: lint → build → test on push
- [ ] All packages build successfully with `bun run build`
```

---

**CARP-002** `[E01]` Package Scaffolding & Shared Contracts  
**Points:** 5 | **Priority:** Critical

```
As a framework developer,
I want all 22+ packages scaffolded with their contracts (interfaces) defined
So that development can proceed in parallel without circular dependencies.

Acceptance Criteria:
- [ ] All packages in /packages/* created with package.json, tsconfig, src/, tests/
- [ ] @formwork/core/contracts/ defines all framework interfaces:
      IApplication, IContainer, IConfig, IRouter, IRequest, IResponse,
      IMiddleware, IKernel, IDatabaseAdapter, ICacheStore, IQueueAdapter,
      IMailAdapter, IStorageAdapter, IAuthGuard, IEventDispatcher
- [ ] All interfaces are ISP-compliant (no god interfaces)
- [ ] Interfaces exported from @formwork/core contracts barrel
- [ ] `@formwork/faker` and `@formwork/padlock` included in the initial scaffold with standard package layout
- [ ] No package relies on committed `dist/` artifacts as canonical source code
- [ ] Zero circular dependency warnings
```

---

**CARP-003** `[E02]` IoC Container — Core Bindings & Resolution  
**Points:** 8 | **Priority:** Critical

```
As a developer,
I want to bind and resolve services from an IoC container
So that dependencies are managed centrally with full DIP compliance.

Technical Spec:
- Container class implementing IContainer
- bind(abstract, concrete): register transient binding
- singleton(abstract, concrete): register singleton
- instance(abstract, value): register pre-built instance
- make<T>(abstract): resolve with auto-wiring via reflection
- Uses reflect-metadata for constructor parameter type reading
- Supports string, Symbol, and Class tokens

Acceptance Criteria:
- [ ] bind() registers a transient factory — new instance per make() call
- [ ] singleton() registers — same instance returned on every make() call
- [ ] instance() stores a pre-built value
- [ ] make() auto-resolves constructor dependencies recursively
- [ ] Circular dependency detection throws CarpenterContainerError
- [ ] Container is itself injectable (self-binding)
- [ ] 100% unit test coverage with no external dependencies
- [ ] Tests mock all filesystem/external calls (there are none at this stage)
```

---

**CARP-004** `[E02]` IoC Container — Decorators (@Injectable, @Inject, @Singleton)  
**Points:** 5 | **Priority:** High

```
As a developer,
I want TypeScript decorators for DI
So that classes can declare their own injectability without manual registration.

Technical Spec:
- @Injectable() — marks a class as resolvable by the container
- @Singleton() — marks a class as a singleton within the container
- @Inject(token) — overrides auto-wired parameter with explicit token
- @Named(name) — named binding support

Acceptance Criteria:
- [ ] @Injectable() registers class metadata via reflect-metadata
- [ ] @Singleton() sets singleton scope on the class descriptor
- [ ] @Inject(MyInterface) overrides the resolved token for a parameter
- [ ] Works with abstract class tokens and Symbol tokens
- [ ] Decorators are tree-shakeable (no side effects at module load unless used)
- [ ] Full unit tests with decorator application scenarios
```

---

**CARP-005** `[E02]` IoC Container — Scoped Bindings & Child Containers  
**Points:** 5 | **Priority:** High

```
As a developer,
I want request-scoped bindings
So that services like the current authenticated user are scoped per HTTP request.

Technical Spec:
- container.scope(): creates a child container inheriting parent bindings
- Scoped bindings resolved once per scope (like .scoped() in .NET DI)
- Child containers fall back to parent for unregistered bindings
- Request scope created per HTTP request, destroyed after response

Acceptance Criteria:
- [ ] container.scope() returns a new child container
- [ ] Scoped singleton resolves the same instance within a scope
- [ ] Two different scopes get different instances of a scoped binding
- [ ] Child container resolves from parent if not registered locally
- [ ] Request lifecycle creates and destroys scope automatically
- [ ] Scope destruction calls dispose() on IDisposable implementations
- [ ] Full tests for scope isolation and parent fallback
```

---

**CARP-006** `[E02]` IoC Container — Service Providers  
**Points:** 5 | **Priority:** High

```
As a developer,
I want Service Providers to organize bindings
So that each package registers its own bindings without touching the container directly.

Technical Spec:
- abstract class ServiceProvider with register() and boot() lifecycle
- register(): called first, binds services — cannot use other services here
- boot(): called after all providers registered, can use resolved services
- Application.register(providers[]) — loads providers in order
- Deferred providers: loaded only when their provided services are resolved

Acceptance Criteria:
- [ ] ServiceProvider abstract class with register() and boot() abstract methods
- [ ] register() is called before boot() for all providers
- [ ] boot() can safely call container.make()
- [ ] Deferred providers implement provides() returning token list
- [ ] Deferred provider is loaded only on first resolution of its token
- [ ] Built-in providers: CoreServiceProvider, HttpServiceProvider
- [ ] Full tests for provider lifecycle ordering
```

---

**Sprint 1 Total: 31 points**

---

### Sprint 2 — Application Kernel & HTTP Foundation (E03 + E04 partial)

**Sprint Goal:** A bootable application with config, env loading, and basic HTTP request/response handling.

---

**CARP-007** `[E03]` Application Bootstrap & Lifecycle  
**Points:** 5 | **Priority:** Critical

```
As a developer,
I want Application.create() to bootstrap the framework
So that all providers are registered and booted before handling requests.

Technical Spec:
- class Application extends Container implements IApplication
- Static Application.create(config: AppConfig): Application
- Lifecycle: load env → load config → register providers → boot providers → ready
- Application.terminate(): graceful shutdown (drain connections, flush queues)
- Singleton: Application.getInstance()

Acceptance Criteria:
- [ ] Application.create() runs full lifecycle in correct order
- [ ] Config loaded from config/ directory files
- [ ] .env parsed and available via env() helper before providers run
- [ ] All registered providers have register() called before any boot()
- [ ] Application emits 'booting', 'booted', 'terminating', 'terminated' events
- [ ] Application.getInstance() returns the same instance (Singleton pattern)
- [ ] Graceful shutdown awaits pending async operations up to configurable timeout
- [ ] Full tests using a TestApplication subclass with mock providers
```

---

**CARP-008** `[E03]` Configuration System  
**Points:** 3 | **Priority:** High

```
As a developer,
I want typed configuration loaded from files and env
So that config values are type-safe and environment-overridable.

Technical Spec:
- Config files: config/app.ts, config/database.ts, config/cache.ts, etc.
- Each returns a plain object; config() helper merges with env overrides
- config('database.default') → dot-notation access
- Generic: config<string>('app.name')
- Caches config in memory after first load (Flyweight-like)

Acceptance Criteria:
- [ ] config() helper resolves dot-notation paths
- [ ] Missing keys return undefined (no throw); config('key', 'default') for defaults
- [ ] TypeScript generic infers return type
- [ ] Config reloaded in test environment via refreshConfig()
- [ ] env() helper with type coercion: env<number>('PORT', 3000)
- [ ] Full unit tests including missing key and type coercion cases
```

---

**CARP-009** `[E04]` HTTP Request Object  
**Points:** 5 | **Priority:** Critical

```
As a developer,
I want a rich Request object wrapping the raw Bun/Node request
So that I can access body, headers, query, params, files in a unified API.

Technical Spec:
- class Request implements IRequest
- request.input(key, default) — body/query merged bag
- request.query(key), request.body(), request.headers()
- request.param(key) — route parameter
- request.file(key): UploadedFile
- request.ip(), request.method(), request.path(), request.url()
- request.isJson(), request.wantsJson(), request.isAjax()
- request.user(): Authenticatable | null (resolved from auth guard)
- Immutable value object pattern for safety

Acceptance Criteria:
- [ ] All methods defined above work correctly
- [ ] Body parsed for JSON, form-urlencoded, multipart automatically
- [ ] UploadedFile has .save(), .getSize(), .getMimeType(), .getOriginalName()
- [ ] request.validate(rules) delegates to Validator and throws ValidationException
- [ ] request.merge() returns a new Request with additional data (immutability)
- [ ] Full unit tests using mock raw requests
```

---

**CARP-010** `[E04]` HTTP Response Object  
**Points:** 3 | **Priority:** Critical

```
As a developer,
I want a fluent Response builder
So that controllers return expressive, consistent responses.

Technical Spec:
- class Response implements IResponse
- response(content, status) — base factory
- Response.json(data, status) — JsonResponse
- Response.view(page, props) — UIResponse (triggers UI bridge)
- Response.redirect(url, status)
- Response.download(file), Response.stream(readable)
- Fluent: response.header(k,v).cookie(name,val,opts).status(201)
- Supports Bun Response and Node ServerResponse

Acceptance Criteria:
- [ ] All factory methods create correct response types
- [ ] Fluent chain returns `this` (Builder pattern)
- [ ] Cookie settings: httpOnly, secure, sameSite, expires
- [ ] Response.view() stores page name + props for UI bridge
- [ ] Content-Type auto-set based on response type
- [ ] Full unit tests for all response types
```

---

**CARP-011** `[E04]` Middleware Pipeline  
**Points:** 5 | **Priority:** Critical

```
As a developer,
I want a composable middleware pipeline (Chain of Responsibility)
So that requests pass through ordered middleware before reaching controllers.

Technical Spec:
- interface IMiddleware { handle(req, next): Promise<Response> }
- class MiddlewarePipeline — Composite pattern
- pipeline.send(request).through(middlewares).then(handler)
- Support class-based middleware (resolved via IoC) and function middleware
- Global middleware, route middleware groups, per-route middleware
- Built-in middleware: BodyParser, CorsMiddleware, CsrfMiddleware,
  TrimStrings, ThrottleRequests, StartSession, ShareErrors

Acceptance Criteria:
- [ ] Pipeline executes middleware in registration order
- [ ] Each middleware receives (req, next) and must call next() or return Response
- [ ] Middleware can short-circuit by returning Response without calling next()
- [ ] Class-based middleware resolved via IoC container
- [ ] Pipeline terminates with the route handler as the final "next"
- [ ] TerminableMiddleware interface for post-response processing
- [ ] Built-in middleware all implemented and tested
- [ ] Full tests including pipeline short-circuit scenarios
```

---

**CARP-012** `[E04]` Router — Route Registration API  
**Points:** 8 | **Priority:** Critical

```
As a developer,
I want a fluent router supporting web and API route groups
So that routes are organized, middleware-grouped, and named.

Technical Spec:
- router.get(path, handler), .post(), .put(), .patch(), .delete(), .options()
- router.group({ prefix, middleware, namespace }, callback) — RouteGroup (Composite)
- router.name('route.name') — named routes
- router.resource('posts', PostController) — resourceful routes (7 RESTful routes)
- router.apiResource('posts', PostController) — 5 API routes (no create/edit)
- Web router and API router share same RouteBuilder but mount at different paths
- Route parameters: /users/:id with optional /:id?
- Route constraints: .where('id', /[0-9]+/)
- Route model binding: :post auto-resolves Post.findOrFail(id)

Acceptance Criteria:
- [ ] All HTTP methods registered correctly
- [ ] route() helper generates URLs from named routes: route('posts.show', {id: 1})
- [ ] Router.resource() generates index, create, store, show, edit, update, destroy
- [ ] Group nesting works to arbitrary depth
- [ ] Middleware applied at group level inherits to child routes
- [ ] Route model binding resolves model or throws 404
- [ ] Router throws on duplicate route names
- [ ] Full unit tests for route matching, URL generation, model binding
```

---

**Sprint 2 Total: 29 points + carry-over buffer**

---

### Sprint 3 — Router Completion & HTTP Kernel (E04 complete)

**Sprint Goal:** Fully working HTTP kernel capable of receiving requests, running middleware, dispatching to controllers, and returning responses.

---

**CARP-013** `[E04]` HTTP Kernel  
**Points:** 8 | **Priority:** Critical

```
As a framework,
I want an HTTP Kernel that ties together routing, middleware, and request lifecycle
So that the application can handle real HTTP requests end-to-end.

Technical Spec:
- class HttpKernel implements IKernel
- kernel.handle(rawRequest): Promise<Response>
- Creates request-scoped child container per request
- Resolves route → builds middleware pipeline → dispatches
- Global exception handling: catches all errors, routes to ExceptionHandler
- ExceptionHandler renders JSON or view based on request type

Acceptance Criteria:
- [ ] kernel.handle() processes request through full pipeline
- [ ] Request-scoped container created and destroyed per request
- [ ] Unhandled exceptions caught and converted to HTTP responses
- [ ] 404 for unmatched routes, 405 for wrong methods
- [ ] 422 for ValidationException with errors payload
- [ ] 500 with stack trace in debug mode, clean message in production
- [ ] Response headers set correctly including X-Request-Id
- [ ] Integration tests: full request → response cycle
```

---

**CARP-014** `[E04]` BaseController & Controller Dispatch  
**Points:** 5 | **Priority:** High

```
As a developer,
I want a BaseController with useful helpers (Template Method pattern)
So that controller classes inherit common behaviour.

Technical Spec:
- abstract class BaseController
- this.validate(request, rules): ValidatedData (throws on failure)
- this.authorize(ability, model?): void (throws AuthorizationException)
- this.view(page, props): Response — renders via UI bridge
- this.json(data, status): JsonResponse
- this.redirect(to): RedirectResponse
- this.notFound(), this.forbidden(), this.unauthorized() helpers
- Single Action Controllers: __invoke() method support

Acceptance Criteria:
- [ ] All helper methods delegating to appropriate services
- [ ] Authorization failure returns 403 before controller logic runs
- [ ] Single action controller dispatched via __invoke
- [ ] Controller methods can be async
- [ ] Controller dependencies injected via IoC (not new'd manually)
- [ ] Full unit tests with mocked services
```

---

**CARP-015** `[E04]` Session System  
**Points:** 5 | **Priority:** High

```
As a developer,
I want a session system with pluggable storage
So that web routes can maintain state across requests.

Technical Spec:
- ISessionStore interface with get, put, forget, flush, all, has
- Session drivers: File, Database, Redis, Cookie, Memory (for testing)
- CSRF token management built into session
- Flash data: session.flash(key, value) — available for one request only
- session.reflash() and session.keep()

Acceptance Criteria:
- [ ] All session drivers implement ISessionStore
- [ ] Session started per request, saved after response
- [ ] Flash data available exactly once after being set
- [ ] CSRF token generated and verified automatically in web middleware
- [ ] Memory driver available for testing (no filesystem/external calls)
- [ ] Full unit tests for each driver using mocks
```

---

**CARP-016** `[E04]` Exception Handling & Result Type  
**Points:** 5 | **Priority:** High

```
As a developer,
I want a typed Result<T, E> type and hierarchy of framework exceptions
So that error handling is explicit and consistent without raw throw.

Technical Spec:
- type Result<T, E extends CarpenterError> = Ok<T> | Err<E>
- ok(value): Ok<T>, err(error): Err<E>
- CarpenterError base class with code, message, context
- Subclasses: HttpException, ValidationException, AuthException,
  AuthorizationException, ModelNotFoundException, RouteNotFoundException
- ExceptionHandler: render(exception, request): Response
- Reportable interface for exceptions that should be logged

Acceptance Criteria:
- [ ] Result type usable with TypeScript narrowing (result.ok, result.err)
- [ ] All framework exceptions extend CarpenterError
- [ ] ExceptionHandler maps each exception type to correct HTTP response
- [ ] Custom exception handlers registered via Application.extend()
- [ ] Exceptions with Reportable interface get logged via logger
- [ ] Full unit tests for all exception types and handler mappings
```

---

**Sprint 3 Total: 23 points**

---

### Sprint 4 — ORM Core: Model & Query Builder (E05 partial)

**Sprint Goal:** A functional BaseModel with Active Record pattern and a type-safe QueryBuilder.

---

**CARP-017** `[E05]` QueryBuilder — Core  
**Points:** 13 | **Priority:** Critical

```
As a developer,
I want a fluent, type-safe QueryBuilder
So that database queries are built programmatically without raw SQL.

Technical Spec:
- class QueryBuilder<T> — Builder pattern
- .select(...cols), .where(col, op, val), .orWhere(), .whereIn(), .whereNull()
- .orderBy(col, dir), .groupBy(col), .having(col, op, val)
- .join(table, local, op, foreign), .leftJoin(), .rightJoin()
- .limit(n), .offset(n)
- .get(): Promise<T[]>, .first(): Promise<T|null>, .firstOrFail(): Promise<T>
- .count(), .sum(col), .avg(col), .min(col), .max(col)
- .paginate(page, perPage): Promise<Paginator<T>>
- .chunk(size, callback): process large datasets in chunks
- Lazy evaluation: builds AST internally, executes via database adapter

Acceptance Criteria:
- [ ] All methods above implemented and chainable
- [ ] QueryBuilder compiles to an AST (Visitor pattern for traversal)
- [ ] AST passed to DatabaseAdapter.execute() — adapter converts to SQL/query
- [ ] No raw SQL in QueryBuilder itself (infrastructure agnostic)
- [ ] Paginator returns { data, total, perPage, currentPage, lastPage }
- [ ] .chunk() calls callback for each batch, supports async callbacks
- [ ] Full unit tests with MockDatabaseAdapter verifying AST structure
```

---

**CARP-018** `[E05]` BaseModel — Active Record  
**Points:** 13 | **Priority:** Critical

```
As a developer,
I want a BaseModel with Active Record pattern
So that models represent database records with rich relationship and query APIs.

Technical Spec:
- abstract class BaseModel<T> — Template Method pattern
- static table: string, static primaryKey: string = 'id'
- Model.find(id), Model.findOrFail(id), Model.where(col, val).get()
- model.save(), model.update(data), model.delete()
- model.fill(data): mass assignment with fillable/guarded
- Dirty tracking: model.isDirty(), model.getOriginal() (Memento pattern)
- Model events: creating, created, updating, updated, deleting, deleted, saving, saved
- Casting: cast attribute values (Date, JSON, boolean, number)
- Timestamps: createdAt, updatedAt auto-managed
- Soft deletes: deletedAt, model.restore(), Model.withTrashed()

Acceptance Criteria:
- [ ] All CRUD methods work through QueryBuilder + DatabaseAdapter
- [ ] Mass assignment respects fillable/guarded (throw if neither set and assign attempted)
- [ ] Dirty tracking stores original values before modification
- [ ] Model events fire at correct lifecycle moments
- [ ] Timestamps automatically set on create/update
- [ ] Soft delete adds WHERE deletedAt IS NULL to all queries automatically
- [ ] Model.withTrashed() removes the soft delete scope
- [ ] Casting converts attribute values on get and set
- [ ] Full unit tests with MockDatabaseAdapter
- [ ] No real database calls in unit tests
```

---

**Sprint 4 Total: 26 points**

---

### Sprint 5 — ORM Relations, Migrations & Seeders (E05 complete)

**Sprint Goal:** Complete ORM with all relation types, migration system, and model factories.

---

**CARP-019** `[E05]` ORM Relations  
**Points:** 13 | **Priority:** High

```
As a developer,
I want all standard Eloquent-style relations
So that related models are loaded and queried naturally.

Relations:
- HasOne, HasMany (via foreign key on related table)
- BelongsTo (via foreign key on this table)
- BelongsToMany (pivot table), with pivot data access
- HasOneThrough, HasManyThrough
- MorphOne, MorphMany, MorphTo (polymorphic)

Acceptance Criteria:
- [ ] Each relation extends BaseRelation<T>
- [ ] Eager loading: Model.with('posts', 'comments.author').get()
- [ ] Lazy loading: await model.posts (returns Collection<Post>)
- [ ] N+1 prevention: withCount(), withAggregate()
- [ ] BelongsToMany: attach(), detach(), sync(), toggle(), updateExistingPivot()
- [ ] Polymorphic relations: model.morphTo() resolves correct model class
- [ ] Constrained eager loading: Model.with({ posts: q => q.where('published', true) })
- [ ] Full unit tests with MockDatabaseAdapter for all relation types
```

---

**CARP-020** `[E05]` Migration System  
**Points:** 8 | **Priority:** High

```
As a developer,
I want a migration system for database schema management
So that schema changes are version-controlled and reversible.

Technical Spec:
- abstract class BaseMigration with up() and down() — Template Method
- Schema builder: Schema.create(table, blueprint => { blueprint.id(); blueprint.string('name'); })
- Blueprint methods: id, uuid, string, text, integer, bigInteger, boolean, json,
  timestamp, timestamps, softDeletes, foreignId, index, unique, nullable, default
- MigrationRunner: reads migrations/, runs pending, tracks in migrations table
- Schema adapter: compiles blueprint to DDL via DatabaseAdapter
- carpenter migrate, migrate:rollback, migrate:fresh, migrate:status

Acceptance Criteria:
- [ ] up()/down() called by MigrationRunner in correct order
- [ ] Migration state tracked in database migrations table
- [ ] Rollback reverses exactly the last batch
- [ ] Schema.create/alter/drop/rename all supported
- [ ] Foreign key constraints supported: blueprint.foreignId('user_id').constrained()
- [ ] Migration runner adapts Blueprint to correct SQL via adapter
- [ ] Full tests with MockDatabaseAdapter verifying blueprint compilation
```

---

**CARP-021** `[E05]` Seeders & Model Factory  
**Points:** 5 | **Priority:** Medium

```
As a developer,
I want model factories and seeders for test data generation
So that I can populate databases for testing and development.

Technical Spec:
- abstract class BaseSeeder — Template Method with run()
- class ModelFactory<T extends BaseModel> — Factory Method pattern
- `@formwork/faker` wraps `@faker-js/faker` behind Carpenter contracts and a Laravel-style `fake()` helper
- factory.definition(): Partial<T> — returns fake data (uses `@formwork/faker`, never direct vendor imports)
- factory.make(overrides?): T — builds without saving
- factory.create(overrides?): Promise<T> — builds and saves
- factory.count(n).create(): creates n records
- factory.state('published', { publishedAt: new Date() }) — states
- factory.for(User, 'user') — set relationship

Acceptance Criteria:
- [ ] factory.make() creates model instance without hitting DB
- [ ] factory.create() persists via model.save()
- [ ] factory.count(5).create() creates 5 records
- [ ] States override specific attributes
- [ ] `fake()` supports deterministic seeds, locale switching, unique values, and sequence helpers
- [ ] Seeders can call other seeders
- [ ] Full tests with MockDatabaseAdapter
```

---

**CARP-021A** `[E05 + E17]` Faker DX Package (`@formwork/faker`)  
**Points:** 5 | **Priority:** Medium

```
As a developer,
I want a first-class faker package with Laravel-style ergonomics
So that factories and tests get modern, deterministic fake data generation without leaking third-party APIs into app code.

Technical Spec:
- Package name: `@formwork/faker`
- Backed internally by `@faker-js/faker`, but exposed via Carpenter-native contracts only
- `fake()` helper returns a typed `FakerManager`
- Supports `seed()`, `locale()`, `unique()`, `sequence()`, and provider registration
- Factory definitions receive the typed Carpenter faker instance
- Provides domain presets for user, company, commerce, finance, dates, and internet data

Acceptance Criteria:
- [ ] `@formwork/faker` exports `fake()`, `FakerManager`, and provider contracts
- [ ] Application code never imports `@faker-js/faker` directly
- [ ] Seeded runs are deterministic across tests and seeder executions
- [ ] Locale switching works per factory/test without global shared-state leaks
- [ ] Custom providers can be registered for app-specific fake data
- [ ] Full unit tests cover seeds, unique pools, sequences, and provider extension
```

---

**Sprint 5 Total: 31 points**

---

### Sprint 6 — Database Adapters (E06)

**Sprint Goal:** Concrete database adapter implementations for Postgres, MySQL, SQLite with a consistent interface.

---

**CARP-022** `[E06]` IDatabaseAdapter Interface & Manager  
**Points:** 3 | **Priority:** Critical

```
As a framework developer,
I want a clean IDatabaseAdapter interface
So that all DB drivers are fully substitutable (LSP compliance).

Acceptance Criteria:
- [ ] IDatabaseAdapter: connect(), disconnect(), execute(ast): QueryResult,
      beginTransaction(), commit(), rollback(), raw(sql, bindings)
- [ ] DatabaseManager: resolves adapter from config, manages connections
- [ ] Abstract Factory: DatabaseManager.registerDriver(driver, factory) + resolve(connection): IDatabaseAdapter
- [ ] Connection pooling hook in adapter interface (Flyweight)
- [ ] Transactions: DB.transaction(callback) auto-commit/rollback
- [ ] Full mock adapter used in all ORM tests
```

---

**CARP-023** `[E06]` PostgreSQL Adapter  
**Points:** 8 | **Priority:** High

```
Acceptance Criteria:
- [ ] Uses 'postgres' package (pg-native compatible)
- [ ] AST compiled to PostgreSQL-dialect SQL with parameterized bindings
- [ ] Connection pool configured via config
- [ ] Transaction support with savepoints
- [ ] RETURNING clause support
- [ ] Schema queries for migration blueprint compilation
- [ ] Integration tests using a real Postgres instance (Docker in CI)
- [ ] Unit tests with mocked pg client
```

---

**CARP-024** `[E06]` MySQL & SQLite Adapters  
**Points:** 8 | **Priority:** High

```
Acceptance Criteria:
- [ ] MySQL adapter using 'mysql2' with async/await
- [ ] SQLite adapter using 'bun:sqlite' (Bun built-in) + 'better-sqlite3' fallback
- [ ] Both compile AST to their respective SQL dialects
- [ ] MySQL: AUTO_INCREMENT handling, backtick identifier quoting
- [ ] SQLite: WAL mode enabled, in-memory option for testing
- [ ] Integration tests for both (SQLite in-memory, MySQL in Docker)
- [ ] Unit tests with mocked clients
```

---

**Sprint 6 Total: 19 points**

---

### Sprint 7 — Cache, Queue, Mail Systems (E07, E08, E09 partial)

**Sprint Goal:** Full cache and queue systems with adapters, plus mail system foundation.

---

**CARP-025** `[E07]` Cache System  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- ICacheStore: get, put, forget, flush, has, increment, decrement, many, putMany
- CacheManager: resolves store by name from config
- Adapters: Redis (ioredis), Memory (Map-based), File, Null (for testing)
- Cache facade: Cache.get('key'), Cache.put('key', val, ttl)
- cache.remember(key, ttl, callback): get or compute and store
- cache.tags(['tag1', 'tag2']).put(key, val) — tag-based invalidation (Redis only)

Acceptance Criteria:
- [ ] All ICacheStore methods implemented in all adapters
- [ ] TTL as Duration object or seconds
- [ ] remember() only executes callback on cache miss
- [ ] Null adapter always misses — useful for testing
- [ ] Memory adapter thread-safe for single-process use
- [ ] All adapter tests run against mock clients (no real Redis in unit tests)
- [ ] Integration tests with real Redis in CI
```

---

**CARP-026** `[E08]` Queue System  
**Points:** 13 | **Priority:** High

```
Technical Spec:
- IQueueAdapter: push(job), pushRaw(payload), later(delay, job), size(queue)
- QueueManager: manages multiple named queues
- abstract class BaseJob — Template Method with handle(), failed(), retryUntil()
- @Dispatchable() decorator: MyJob.dispatch(data), MyJob.dispatchAfter(delay, data)
- Adapters: BullMQ (Redis-backed), SQS, Database, Sync (executes immediately)
- QueueWorker: listens to queue, processes jobs, handles retries and failures
- Job middleware: WithoutOverlapping, RateLimited, ThrottlesExceptions

Acceptance Criteria:
- [ ] BaseJob.handle() called by worker
- [ ] Failed jobs: failed() called on exception, stored in failed_jobs table
- [ ] Retry: tries and retryAfter configurable per job class
- [ ] Sync adapter executes job in same process synchronously
- [ ] Database adapter stores jobs in jobs table (useful without Redis)
- [ ] BullMQ adapter wraps Bull queue — tested with mock Redis client
- [ ] QueueWorker processes jobs in a loop, graceful shutdown on SIGTERM
- [ ] Unit tests: mock adapters, verify job payload serialization
- [ ] Integration tests: BullMQ with test Redis
```

---

**CARP-027** `[E09]` Mail System  
**Points:** 8 | **Priority:** Medium

```
Technical Spec:
- IMailAdapter: send(message: MailMessage): Promise<void>
- MailMessage: to, cc, bcc, subject, html, text, attachments, replyTo
- abstract class BaseMailable — Template Method with build(): MailMessage
- MailManager: resolves adapter by name
- Adapters: SMTP (nodemailer), SES (aws-sdk), Mailgun, Resend, Log, Array
- Mail facade: Mail.to(user).send(new WelcomeMail(user))
- Mail.fake() for testing: replaces adapter with Array driver

Acceptance Criteria:
- [ ] BaseMailable.build() constructs MailMessage
- [ ] Mail.to() accepts User model (extracts email/name) or string
- [ ] SMTP adapter uses nodemailer transport
- [ ] Array adapter stores sent mails in memory — Mail.assertSent(WelcomeMail)
- [ ] Log adapter writes to logger instead of sending
- [ ] Mail.fake() swaps adapter to Array for test assertions
- [ ] All adapters tested with mocked transport clients
```

---

**Sprint 7 Total: 29 points**

---

### Sprint 8 — Storage, Auth & Validation (E10, E11, E12)

**Sprint Goal:** File storage adapters, authentication/authorization system, and validation.

---

**CARP-028** `[E10]` Storage System  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- IStorageAdapter: get, put, delete, exists, url, temporaryUrl, copy, move,
  list, makeDirectory, deleteDirectory, mimeType, size, lastModified
- StorageManager: resolves disk by name
- Adapters: Local (filesystem), S3 (aws-sdk v3), GCS (@google-cloud/storage), Memory
- Storage facade: Storage.disk('s3').put('path/file.jpg', content)
- Visibility: public/private per file

Acceptance Criteria:
- [ ] All IStorageAdapter methods in all adapters
- [ ] Local adapter uses native fs with configurable root
- [ ] S3 adapter uses @aws-sdk/client-s3 with presigned URL support
- [ ] Memory adapter for unit testing (no filesystem calls)
- [ ] Visibility maps to ACL in S3, file permissions locally
- [ ] Unit tests: all adapters with mocked clients
```

---

**CARP-029** `[E11]` Auth System — Guards, Providers & Middleware  
**Points:** 13 | **Priority:** High

```
Technical Spec:
- IAuthGuard: user(), check(), guest(), id(), login(user), logout(), attempt(credentials)
- Guards: SessionGuard, JwtGuard, ApiTokenGuard
- IUserProvider: retrieveById, retrieveByCredentials, validateCredentials
- Hash service: HashManager with bcrypt, argon2 drivers (Strategy pattern)
- Auth middleware: @Auth, @Guest, @Can('permission')
- Auth facade: Auth.user(), Auth.check(), Auth.id()
- Multi-guard: Auth.guard('api').user()
- Password reset/token primitives consumed by higher-level workflow packages
- Low-level auth primitives stay in `@formwork/auth`; end-user auth flows live in `@formwork/padlock`

Acceptance Criteria:
- [ ] SessionGuard reads/writes user from session
- [ ] JwtGuard parses Bearer token from Authorization header
- [ ] ApiTokenGuard matches hashed token in database
- [ ] attempt() hashes password and compares via HashManager
- [ ] @Auth middleware returns 401 if guard returns null
- [ ] @Can() middleware evaluates Gate policy
- [ ] Full tests with mock user providers and mock sessions
```

---

**CARP-029A** `[E11]` Padlock Package — Workflow Layer & Package Recovery  
**Points:** 5 | **Priority:** High

```
As a framework developer,
I want a dedicated Padlock package with a normal source layout
So that higher-level authentication workflows are first-class and the package is no longer effectively hidden inside build artifacts.

Technical Spec:
- Package name: `@formwork/padlock`
- Sits on top of `@formwork/auth` and provides Laravel Fortify-style workflows:
  registration, login, logout, forgot password, password reset, email verification,
  TOTP-based two-factor auth, recovery codes, and lockout throttling
- Canonical package layout must be `package.json`, `tsconfig.json`, `src/`, `tests/`
- `dist/` remains generated output only; source-of-truth implementation lives in `src/`
- Public surface includes `PadlockService`, `PadlockController`,
  `PadlockServiceProvider`, `registerPadlockRoutes`, notifier contracts/fakes,
  in-memory repositories, and token stores for tests/starters

Acceptance Criteria:
- [ ] `packages/padlock/package.json`, `src/`, and `tests/` exist as the canonical package layout
- [ ] No runtime or build step depends on hidden implementation files under `dist/`
- [ ] Registration/login/logout/password reset/email verification flows are implemented
- [ ] Two-factor auth supports TOTP challenges, recovery codes, and attempt lockout
- [ ] HTTP route registrar integrates cleanly with `@formwork/http`
- [ ] Mail and notification hooks integrate cleanly with `@formwork/mail`
- [ ] In-memory repositories, token stores, and notifier fakes ship for tests and starter kits
- [ ] Full tests cover happy paths, lockouts, token expiry, and invalid-token flows
```

---

**CARP-030** `[E11]` Gate & Policies (Authorization)  
**Points:** 5 | **Priority:** High

```
Technical Spec:
- Gate class: define(ability, callback), allows(user, ability, model?)
- Gate.policy(ModelClass, PolicyClass) — auto-discovers policy methods
- abstract class BasePolicy with before() hook
- Gate integrated with BaseController.authorize()

Acceptance Criteria:
- [ ] Gate.define('update-post', (user, post) => user.id === post.userId)
- [ ] Gate.allows(user, 'update-post', post) returns boolean
- [ ] Policy class methods map to abilities: policy.update(user, model)
- [ ] before() returning false short-circuits all ability checks
- [ ] SuperAdmin pattern: before() returning true bypasses all checks
- [ ] Full unit tests
```

---

**CARP-031** `[E12]` Validation System  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- Validator.make(data, rules, messages?): ValidationResult
- Rules: required, nullable, string, number, boolean, array, object,
  min, max, between, in, notIn, email, url, uuid, regex, unique (DB),
  exists (DB), confirmed, date, before, after, mimes, maxSize
- abstract class BaseFormRequest — Template Method
- FormRequest: rules(), authorize(), messages(), attributes() overrides
- Conditional rules: Rule.when(), Rule.requiredIf()
- Custom rules: implement IValidationRule or use Rule.make(callback)

Acceptance Criteria:
- [ ] Validator returns { passes: boolean, errors: Record<string, string[]> }
- [ ] All listed rules implemented and tested
- [ ] Nested rules: 'address.city' => ['required', 'string']
- [ ] Array rules: 'tags.*' => ['string', 'max:50']
- [ ] unique/exists rules use MockDatabaseAdapter in tests
- [ ] BaseFormRequest.validated() returns data or throws ValidationException
- [ ] ValidationException carries structured errors payload
- [ ] 100% rule coverage in tests
```

---

**Sprint 8 Total: 39 points**

---

### Sprint 9 — Events System & OOP Utilities (E13 + Support)

**Sprint Goal:** Event system, Collection class, string/array helpers, and full OOP utility layer.

---

**CARP-032** `[E13]` Event Dispatcher  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- EventDispatcher: on(event, listener), emit(event, payload), once()
- abstract class BaseEvent with broadcastOn() for broadcasting
- abstract class BaseListener — handle(event), shouldQueue boolean
- EventSubscriber: subscribe(dispatcher) — registers multiple events
- Dispatcher dispatches queued listeners to Queue system
- Sync dispatch: EventDispatcher.dispatch(new UserRegistered(user))
- Async queued dispatch: listeners with shouldQueue = true pushed to queue

Acceptance Criteria:
- [ ] on() registers listener for event
- [ ] emit() calls all registered listeners in order
- [ ] Queued listeners dispatched via Queue system (MockQueue in tests)
- [ ] EventSubscriber.subscribe() registers all its listeners at once
- [ ] Wildcard listeners: on('user.*', listener)
- [ ] EventFake for testing: Event.fake(), Event.assertDispatched(UserRegistered)
- [ ] Full tests including async queued dispatch with MockQueue
```

---

**CARP-033** `[Core]` Collection<T> Class  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- class Collection<T> implements Iterable<T> — Iterator pattern
- map, filter, reduce, find, findOrFail, first, last, groupBy, keyBy
- chunk(size), flatten, pluck(key), unique(key?), sortBy(key), sortByDesc
- contains(item|fn), every(fn), some(fn), isEmpty, isNotEmpty
- sum(key), avg(key), min(key), max(key), count()
- toArray(), toJson(), toMap()
- collect(array) helper function
- Lazy variant: LazyCollection using generators for memory efficiency

Acceptance Criteria:
- [ ] All methods above correctly implemented
- [ ] Collection is immutable: each method returns a new Collection
- [ ] LazyCollection defers execution until terminal method called
- [ ] Works with any T (not just models)
- [ ] Full unit tests with 100% method coverage
```

---

**CARP-034** `[Core]` Str, Arr, Carbon Utilities  
**Points:** 5 | **Priority:** Medium

```
Technical Spec:
- Str: camelCase, pascalCase, snakeCase, kebabCase, studly, slug, plural,
  singular, contains, startsWith, endsWith, limit, wordCount, random(n), uuid()
- Arr: dot, undot, get(data, key), set(data, key, val), forget, has,
  wrap, flatten, pluck, only, except, first, last, crossJoin, zip
- Carbon: lightweight date wrapper (wraps Temporal or native Date)
  now(), parse(str), addDays, subDays, diffForHumans, format, isBefore, isAfter
- All as static utility classes + global helpers (str(), arr(), now())

Acceptance Criteria:
- [ ] All methods above correctly implemented
- [ ] Str.uuid() uses crypto.randomUUID()
- [ ] Arr.get() supports dot-notation: Arr.get(obj, 'user.address.city')
- [ ] Carbon.now() returns UTC by default, timezone-aware via .tz()
- [ ] Full unit test coverage
```

---

**Sprint 9 Total: 21 points**

---

### Sprint 10 — CarpenterUI Engine Part 1: VDOM & Compiler (E14 partial)

**Sprint Goal:** CarpenterUI virtual DOM, .carp single-file component format, and compiler.

---

**CARP-035** `[E14]` Virtual DOM Implementation  
**Points:** 13 | **Priority:** High

```
Technical Spec:
- VNode type: { type, props, children, key, ref }
- h(type, props, ...children): VNode — hyperscript factory
- diff(oldVNode, newVNode): Patch[]
- patch(domNode, patches): applies patches to real DOM
- Keyed reconciliation for list rendering
- Fragments, portals, conditional rendering
- Component lifecycle: onMount, onUpdate, onUnmount hooks

Acceptance Criteria:
- [ ] h() creates correct VNode structure
- [ ] diff() produces minimal patch set (no unnecessary re-renders)
- [ ] patch() correctly updates DOM with each patch type (insert, remove, update, replace)
- [ ] Keyed lists reorder without remounting stable items
- [ ] onMount fires after DOM insertion
- [ ] onUnmount fires before DOM removal
- [ ] Full unit tests for diff algorithm with complex tree scenarios
- [ ] No DOM dependency in diff/VNode logic (runs in Bun/Node for SSR)
```

---

**CARP-036** `[E14]` .carp Single-File Component Format & Compiler  
**Points:** 13 | **Priority:** High

```
.carp file format:
<script>
export default defineComponent({
  props: { title: String },
  setup(props) {
    const count = signal(0)
    return { count }
  }
})
</script>

<template>
  <div class="page">
    <h1>{{ title }}</h1>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>

<style scoped>
.page { padding: 1rem; }
</style>

Technical Spec:
- Bun plugin / Vite plugin for .carp file transformation
- Compiler stages: parse → analyze → transform → codegen
- Template compiler: template AST → render function (h() calls)
- Scoped styles: hash class names, inject into <head>
- Script setup: <script setup> sugar syntax
- TypeScript support in <script> block

Acceptance Criteria:
- [ ] .carp files compile to valid TypeScript/JavaScript modules
- [ ] Template expressions {{ }} correctly evaluated
- [ ] Directives: @click, @input, :prop, v-if, v-for, v-model, v-show
- [ ] Scoped styles generate unique class suffix
- [ ] Compiler errors include source position (line/col) in .carp file
- [ ] Compiled output is tree-shakeable
- [ ] Full compiler tests with AST snapshot testing
```

---

**Sprint 10 Total: 26 points**

---

### Sprint 11 — CarpenterUI Engine Part 2: Reactivity, SSR & Router (E14 complete)

**Sprint Goal:** Signals-based reactive state, SSR renderer, and client-side router for CarpenterUI.

---

**CARP-037** `[E14]` Signals-Based Reactive State  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- signal<T>(initial): Signal<T> — reactive primitive (get/set/subscribe)
- computed<T>(fn): Computed<T> — derived signal, lazy
- effect(fn): Effect — runs fn when dependencies change, cleanup on unmount
- store<T>(definition): Store<T> — structured reactive state object
- No proxy magic — explicit signal primitives (Solid.js-inspired)
- Batch updates: batch(() => { s1.set(1); s2.set(2) }) — single re-render

Acceptance Criteria:
- [ ] signal().get() returns current value
- [ ] signal().set(val) triggers subscribed effects
- [ ] computed() recalculates only when dependencies change (memoized)
- [ ] effect() tracks accessed signals automatically
- [ ] effect cleanup function called on re-run and unmount
- [ ] batch() groups updates into single re-render pass
- [ ] No memory leaks: effects disposed when component unmounts
- [ ] Full unit tests for reactivity graph
```

---

**CARP-038** `[E14]` Server-Side Renderer (SSR)  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- renderToString(component, props): string — synchronous SSR
- renderToStream(component, props): ReadableStream — streaming SSR
- Hydration markers embedded in HTML: data-hid attributes
- Client hydration: hydrate(component, container, props) — attaches events without full re-render
- SSR context: inject CSS, preload data, set HTTP headers

Acceptance Criteria:
- [ ] renderToString() produces valid HTML matching VDOM output
- [ ] Streaming SSR flushes shell HTML first, then streamed content
- [ ] Hydration preserves server-rendered DOM, attaches event listeners
- [ ] No hydration mismatch errors for matching server/client renders
- [ ] SSR context captures CSS used during render
- [ ] Full tests comparing SSR output to JSDOM-rendered output
```

---

**CARP-039** `[E14]` CarpenterUI Client Router  
**Points:** 5 | **Priority:** High

```
Technical Spec:
- SPA-style client routing using History API
- router.push(to), router.replace(to), router.back()
- <RouterLink to="/about"> component
- Route guards: beforeEach, afterEach
- Lazy page loading: () => import('./pages/About.carp')
- Nested routes and route params

Acceptance Criteria:
- [ ] Navigation updates URL and renders correct component
- [ ] Route params extracted and passed as props
- [ ] beforeEach guard can cancel or redirect navigation
- [ ] Lazy routes loaded on first navigation (code splitting)
- [ ] RouterLink renders <a> with active class when route matches
- [ ] Full tests with mock History API
```

---

**Sprint 11 Total: 21 points**

---

### Sprint 12 — UI Bridge: Web Routes → UI (E15)

**Sprint Goal:** Inertia-style web route to UI bridge enabling server-driven navigation with shared data.

---

**CARP-040** `[E15]` UI Bridge Core — Page Props Protocol  
**Points:** 8 | **Priority:** Critical

```
Technical Spec:
- When controller calls this.view('Pages/Dashboard', props), server returns:
  - First request: full HTML with page component name + props as JSON in window.__PAGE__
  - Subsequent requests (X-Carpenter-Request header): JSON { component, props, sharedData }
- BridgeMiddleware: injects shared data (auth user, flash messages, errors) into every response
- Client intercepts <a> clicks and form submits → sends X-Carpenter-Request header
- Client receives JSON → updates page component + props without full reload

Acceptance Criteria:
- [ ] First request returns full SSR HTML
- [ ] Subsequent Carpenter requests return JSON only
- [ ] BridgeMiddleware adds auth.user, flash, errors to every response
- [ ] Client router intercepts navigation and uses bridge protocol
- [ ] Form submissions via bridge return redirect or new page data
- [ ] Progress bar shown during bridge requests
- [ ] Full integration tests: simulate first load and navigation requests
```

---

**CARP-041** `[E15]` Shared Data, Flash & Error Propagation  
**Points:** 5 | **Priority:** High

```
Technical Spec:
- Bridge.share(key, value): adds to shared data for all responses
- Bridge.share(key, () => value): lazy-evaluated share (runs per request)
- Flash messages flow: session.flash() → available in next page render
- Validation errors forwarded to UI: errors bag available in components
- usePage() composable: access props, sharedData, errors in .carp components

Acceptance Criteria:
- [ ] Bridge.share() static value available in all page renders
- [ ] Lazy share callback executed per request (not cached)
- [ ] Flash messages appear in next request's shared data, cleared after
- [ ] Validation errors populate errors object in usePage()
- [ ] usePage() reactive — components re-render when props update
- [ ] Full tests with simulated request sequences
```

---

**CARP-042** `[E15]` Bridge Form Helpers  
**Points:** 5 | **Priority:** Medium

```
Technical Spec:
- useForm(initialData) composable for .carp and UI adapters
- form.data, form.errors, form.processing, form.progress
- form.post(url), form.put(url), form.patch(url), form.delete(url)
- form.reset(), form.clearErrors()
- form.transform(fn): transform data before submission
- Automatic CSRF header injection

Acceptance Criteria:
- [ ] form.post() sends request with X-Carpenter-Request header
- [ ] form.errors populated from server ValidationException response
- [ ] form.processing = true during submission
- [ ] form.reset() restores initial data
- [ ] CSRF token included automatically from session
- [ ] Full tests simulating form submission flow
```

---

**Sprint 12 Total: 18 points**

---

### Sprint 13 — Pluggable UI Adapters (E16)

**Sprint Goal:** React and Vue adapter packages that plug into the Carpenter bridge.

---

**CARP-043** `[E16]` React Adapter (@formwork/ui-react)  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- CarpenterApp React component: bootstraps bridge, wraps pages
- usePage() React hook: returns { props, sharedData, errors }
- useForm() React hook: mirrors CarpenterUI useForm
- Link component: <Link href="/about"> — bridge-aware
- createCarpenterApp(pages): sets up routing from page map
- SSR: renderToString using React's SSR, hydrate on client

Acceptance Criteria:
- [ ] CarpenterApp renders correct page component based on bridge response
- [ ] usePage() returns typed props for current page
- [ ] Link component uses bridge protocol instead of full page load
- [ ] useForm() has same API as CarpenterUI version
- [ ] SSR renders correct HTML, client hydrates without mismatch
- [ ] Works with React 18 (concurrent mode compatible)
- [ ] Full tests with React Testing Library
```

---

**CARP-044** `[E16]` Vue Adapter (@formwork/ui-vue)  
**Points:** 8 | **Priority:** High

```
Technical Spec:
- createCarpenterApp(pages): Vue app factory
- usePage() Vue composable
- useForm() Vue composable
- <Link> Vue component
- SSR: @vue/server-renderer integration
- Works with Vue 3 Composition API

Acceptance Criteria:
- [ ] Mirrors React adapter API exactly where possible
- [ ] Vue 3 Composition API throughout
- [ ] SSR with @vue/server-renderer
- [ ] Full tests with @vue/test-utils
```

---

**CARP-045** `[E16]` Svelte & Solid Adapters  
**Points:** 5 | **Priority:** Medium

```
Acceptance Criteria:
- [ ] @formwork/ui-svelte: SvelteKit-compatible integration
- [ ] @formwork/ui-solid: SolidJS integration with createSignal-based state
- [ ] Both implement same bridge protocol (usePage, useForm, Link)
- [ ] Basic tests for each adapter
```

---

**Sprint 13 Total: 21 points**

---

### Sprint 14 — Testing Infrastructure (E17)

**Sprint Goal:** Complete testing package with application test harness, HTTP client, all mocks, and test traits.

---

**CARP-046** `[E17]` TestApplication & Test Bootstrapper  
**Points:** 5 | **Priority:** Critical

```
Technical Spec:
- class TestApplication extends Application
- Overrides: in-memory session, SQLite in-memory DB, null cache, sync queue, array mail
- withProviders([]): override specific providers for a test suite
- TestCase base class: setUp/tearDown lifecycle, access to app
- Global test setup: loads TestApplication once per suite, resets state between tests

Acceptance Criteria:
- [ ] TestApplication boots without real external services
- [ ] DB automatically uses SQLite in-memory
- [ ] Queue automatically uses Sync driver
- [ ] Mail automatically uses Array driver
- [ ] Each test gets a fresh application state
- [ ] withProviders() allows targeted provider replacement
```

---

**CARP-047** `[E17]` TestHttpClient  
**Points:** 8 | **Priority:** Critical

```
Technical Spec:
- class TestHttpClient
- get(url, headers?), post(url, body, headers?), put, patch, delete
- Returns TestResponse with: assertStatus(n), assertJson(shape),
  assertRedirect(url), assertSee(text), assertSessionHas(key),
  assertCookieSet(name), assertValidationErrors(fields)
- Authenticated requests: actingAs(user, guard?)
- withHeaders({}), withCookie({})
- Bridge requests: visitPage(url): TestBridgeResponse

Acceptance Criteria:
- [ ] All HTTP methods send requests through kernel.handle()
- [ ] TestResponse assertions throw with descriptive messages on failure
- [ ] actingAs() binds the user to the request-scoped auth guard
- [ ] Session state preserved between requests in same test
- [ ] Full tests verifying each assertion method
```

---

**CARP-048** `[E17]` Infrastructure Mocks  
**Points:** 8 | **Priority:** Critical

```
Mock Implementations:
- MockDatabaseAdapter: records queries, returns configurable results
- MockCacheStore: in-memory Map, verifiable
- MockQueueAdapter: stores jobs, assertable
- MockMailAdapter: stores messages, Mail.assertSent(Mailable, fn?)
- MockStorageAdapter: in-memory file store
- MockEventDispatcher: Event.fake(), Event.assertDispatched()

Acceptance Criteria:
- [ ] All mocks implement their respective interfaces (LSP compliant)
- [ ] All mocks record calls for assertion: mock.assertCalled(method, args)
- [ ] Mocks configurable to return specific values or throw errors
- [ ] MockDatabaseAdapter can replay a sequence of results
- [ ] Full tests for each mock (mocks are tested too!)
- [ ] All mocks exported from @formwork/testing
```

---

**CARP-049** `[E17]` Database Test Traits  
**Points:** 5 | **Priority:** High

```
Technical Spec:
- DatabaseTransactions trait: wraps each test in a transaction, auto-rollback
- RefreshDatabase trait: migrates fresh before suite, truncates between tests
- WithFaker trait: provides `@formwork/faker` instance
- WithFactories trait: factory() helper shortcut

Acceptance Criteria:
- [ ] DatabaseTransactions: no data persists between tests
- [ ] RefreshDatabase: runs migrate:fresh before test class, truncates tables between tests
- [ ] Traits composable: can use multiple traits simultaneously
- [ ] WithFaker supports per-test seed and locale overrides
- [ ] Works with TestApplication SQLite in-memory DB
```

---

**Sprint 14 Total: 26 points**

---

### Sprint 15 — CLI Toolchain (E18)

**Sprint Goal:** Full `carpenter` CLI with all generators, migration commands, and project creation.

---

**CARP-050** `[E18]` CLI Foundation & Project Creation  
**Points:** 5 | **Priority:** High

```
Technical Spec:
- `carpenter` binary using Commander.js
- `carpenter new <name>`: creates new project from template
- Interactive prompts: runtime (Bun/Node), UI adapter, database, auth

Acceptance Criteria:
- [ ] carpenter new creates correct project structure
- [ ] .env.example generated with all config keys
- [ ] package.json, tsconfig.json, biome.json pre-configured
- [ ] carpenter --version, carpenter --help
- [ ] create-carpenter-app package for npx usage
```

---

**CARP-051** `[E18]` Code Generators  
**Points:** 8 | **Priority:** High

```
Commands:
- carpenter make:controller <Name> [--resource] [--api]
- carpenter make:model <Name> [--migration] [--factory] [--seeder]
- carpenter make:migration <name>
- carpenter make:seeder <Name>
- carpenter make:job <Name>
- carpenter make:event <Name>
- carpenter make:listener <Name> [--event=EventName]
- carpenter make:middleware <Name>
- carpenter make:policy <Name> [--model=ModelName]
- carpenter make:provider <Name>
- carpenter make:request <Name>
- carpenter make:mail <Name>
- carpenter make:page <Name> (CarpenterUI page)
- carpenter make:component <Name> (CarpenterUI component)

Acceptance Criteria:
- [ ] Each generator creates a correctly structured stub file
- [ ] Stubs respect configured namespace/paths from carpenter.config.ts
- [ ] --model flag injects model import and type into generated file
- [ ] --resource flag generates all 7 resource controller methods
- [ ] Generated code passes TypeScript compiler without errors
- [ ] Full tests: generator produces expected file content
```

---

**CARP-052** `[E18]` Database & App Commands  
**Points:** 5 | **Priority:** High

```
Commands:
- carpenter migrate [--step=n]
- carpenter migrate:rollback [--step=n]
- carpenter migrate:fresh [--seed]
- carpenter migrate:status
- carpenter db:seed [--class=SeederName]
- carpenter serve [--port=3000] [--watch]
- carpenter build [--ssr]
- carpenter queue:work [--queue=name] [--tries=3]
- carpenter schedule:run
- carpenter key:generate

Acceptance Criteria:
- [ ] carpenter serve starts Bun/Node HTTP server with hot reload in --watch mode
- [ ] carpenter build bundles frontend assets via Bun bundler
- [ ] carpenter migrate runs pending migrations and reports status
- [ ] carpenter queue:work starts worker loop with graceful shutdown
- [ ] All commands accept --help flag with documentation
- [ ] Full tests for command parsing (not integration tests for DB commands)
```

---

**Sprint 15 Total: 18 points**

---

### Sprint 16 — Resilience Patterns & Advanced Features (E19)

**Sprint Goal:** Circuit breaker, retry, rate limiter, and pipeline utilities for production resilience.

---

**CARP-053** `[E19]` Circuit Breaker  
**Points:** 5 | **Priority:** Medium

```
Technical Spec:
- CircuitBreaker class — State pattern: Closed, Open, HalfOpen
- new CircuitBreaker({ threshold: 5, timeout: 60000, halfOpenMax: 1 })
- breaker.execute(fn): runs fn or throws CircuitOpenError
- Transitions: Closed → Open on threshold failures, Open → HalfOpen after timeout
- Events: open, close, halfOpen, success, failure
- Per-service breakers registered in IoC

Acceptance Criteria:
- [ ] Opens after threshold consecutive failures
- [ ] Rejects calls immediately while Open
- [ ] Transitions to HalfOpen and allows one probe call after timeout
- [ ] Closes on successful probe, re-opens on failed probe
- [ ] All state transitions emit events
- [ ] Full unit tests for all state transitions
```

---

**CARP-054** `[E19]` Retry & Rate Limiter  
**Points:** 5 | **Priority:** Medium

```
Technical Spec:
- retry(fn, { times: 3, delay: 1000, backoff: 'exponential' }): Promise<T>
- Backoff strategies: fixed, linear, exponential, jitter
- RateLimiter: limiter.attempt(key, maxAttempts, decaySeconds)
- RateLimiter backed by cache (ICacheStore)
- ThrottleRequests middleware uses RateLimiter

Acceptance Criteria:
- [ ] retry() retries on thrown errors up to times limit
- [ ] Exponential backoff doubles delay each attempt
- [ ] RateLimiter.attempt() returns false if limit exceeded
- [ ] RateLimiter keys expire after decaySeconds
- [ ] ThrottleRequests returns 429 with Retry-After header
- [ ] Full tests with mocked timers and mock cache
```

---

**CARP-055** `[Core]` Pipeline & Tap Utilities  
**Points:** 3 | **Priority:** Medium

```
Technical Spec:
- Pipeline.send(passable).through(pipes[]).then(destination)
- pipe(passable, ...fns): functional pipeline
- tap(value, fn): execute fn with value, return value (debugging)
- Transformer pattern: transform(data).using(TransformerClass)

Acceptance Criteria:
- [ ] Pipeline executes pipes in order, passing result of each to next
- [ ] Supports both class-based pipes (with handle()) and functions
- [ ] tap() does not modify the piped value
- [ ] Full unit tests
```

---

**Sprint 16 Total: 13 points**

---

### Sprint 17 — Advanced ORM & Performance Features

**Sprint Goal:** ORM query scopes, observers, casting, and performance optimizations.

---

**CARP-056** `[E05]` Query Scopes & Model Observers  
**Points:** 5 | **Priority:** Medium

```
Technical Spec:
- Global scopes: always applied (e.g., SoftDeleteScope)
- Local scopes: Model.published().active().get()
- scope method naming: scopePublished() → .published()
- Model Observers: class UserObserver { creating(), created(), updating()... }
- Model.observe(UserObserver): registers all lifecycle hooks
- withoutGlobalScope(ScopeClass): remove a global scope for a query

Acceptance Criteria:
- [ ] Global scopes auto-applied to all queries on model
- [ ] withoutGlobalScope() removes specified scope for that query
- [ ] Local scope methods chainable with other query builder methods
- [ ] Observer methods called at correct lifecycle points
- [ ] Full tests with MockDatabaseAdapter
```

---

**CARP-057** `[E05]` ORM Caching & Advanced Casting  
**Points:** 5 | **Priority:** Medium

```
Technical Spec:
- Model.remember(ttl).where().get(): caches query result
- Model.forgetCache(key): invalidates specific cache entry
- Advanced casts: AsCollection, AsEncrypted, AsHashMap, custom Cast classes
- Value Objects: cast to custom VO classes (implement Castable interface)
- JSON casting: cast('meta', 'json') auto-encodes/decodes

Acceptance Criteria:
- [ ] remember() wraps query in Cache.remember()
- [ ] Cached query uses hash of SQL + bindings as cache key
- [ ] Custom cast class: implements CastsAttributes { get(), set() }
- [ ] JSON cast encodes on save, decodes on retrieve
- [ ] Full tests with MockCacheStore and MockDatabaseAdapter
```

---

**CARP-058** `[E04]` Rate Limiting & Throttling Routes  
**Points:** 3 | **Priority:** Medium

```
Technical Spec:
- router.middleware(['throttle:60,1']) — 60 requests per minute
- Named limiters: RateLimiter.for('api', request => Limit.perMinute(60))
- Per-user limits: Limit.perMinute(100).by(request.user()?.id ?? request.ip())
- Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

Acceptance Criteria:
- [ ] Named limiter resolves correct limit per request
- [ ] Per-user bucketing works correctly
- [ ] 429 returned with correct headers when limit exceeded
- [ ] Full tests with mocked RateLimiter
```

---

**Sprint 17 Total: 13 points**

---

### Sprint 18 — Scheduling, Notifications & Broadcasting

**Sprint Goal:** Task scheduler, notification system, and WebSocket broadcasting.

---

**CARP-059** `[Core]` Task Scheduler  
**Points:** 8 | **Priority:** Medium

```
Technical Spec:
- Schedule.command('emails:send').daily()
- Schedule.call(fn).everyMinute().withoutOverlapping()
- Cron expression support: .cron('* * * * *')
- Fluent time helpers: .hourly(), .daily(), .weekly(), .monthly()
- .between('8:00', '17:00'), .weekdays(), .onOneServer()
- carpenter schedule:run executes due tasks
- carpenter schedule:work runs the scheduler loop (long-running)

Acceptance Criteria:
- [ ] Schedule.command() creates a scheduled task entry
- [ ] Due tasks determined by comparing cron expression to current time
- [ ] withoutOverlapping() uses Cache lock to prevent duplicate runs
- [ ] onOneServer() acquires a distributed lock via cache
- [ ] Full tests with mocked time and mocked cache for locks
```

---

**CARP-060** `[Core]` Notification System  
**Points:** 8 | **Priority:** Medium

```
Technical Spec:
- abstract class BaseNotification with via(notifiable): string[]
- Notifiable mixin: notify(notification), notifyNow(notification)
- Channels: Mail, Database, SMS (placeholder), Broadcast
- Database channel: stores in notifications table, with read/unread tracking
- Notification.fake() for testing

Acceptance Criteria:
- [ ] User model + Notifiable mixin: user.notify(new OrderShipped(order))
- [ ] via() returns ['mail', 'database'] — notification sent via both
- [ ] Database channel: stores notification JSON in DB
- [ ] Mail channel delegates to Mail system
- [ ] Notification.fake() captures notifications for assertion
- [ ] Full tests with all mock channels
```

---

**CARP-061** `[Core]` WebSocket / Broadcasting  
**Points:** 8 | **Priority:** Low

```
Technical Spec:
- IBroadcastAdapter: broadcast(channel, event, data)
- Adapters: Pusher/Soketi, Ably, Native WebSocket (Bun built-in)
- Broadcastable event: implements ShouldBroadcast, broadcastOn(), broadcastWith()
- Channel authorization: routes/channels.ts
- Client-side: CarpenterEcho (thin wrapper or re-export of Laravel Echo compatible API)

Acceptance Criteria:
- [ ] Broadcastable events broadcast via configured adapter
- [ ] Private channels require authorization callback
- [ ] Bun native WebSocket adapter uses Bun.serve WebSocket support
- [ ] Mock broadcast adapter for testing: assertBroadcasted(channel, event)
- [ ] Full tests with mock adapter
```

---

**Sprint 18 Total: 24 points**

---

### Sprint 19 — Performance, Security & Hardening

**Sprint Goal:** Security hardening, performance profiling hooks, and production-readiness review.

---

**CARP-062** `[Security]` Security Middleware Suite  
**Points:** 8 | **Priority:** High

```
Built-in Security Middleware:
- CsrfMiddleware: validates X-CSRF-TOKEN or _token on POST/PUT/PATCH/DELETE
- CorsMiddleware: configurable origins, methods, headers, credentials
- SecureHeaders: HSTS, X-Frame-Options, CSP, X-Content-Type-Options
- SanitizeInput: strips null bytes, normalizes unicode
- EncryptCookies: AES-256-GCM encryption for session/auth cookies
- TrustProxies: configures trusted proxy IPs for X-Forwarded-For

Acceptance Criteria:
- [ ] CSRF validation rejects invalid tokens with 419
- [ ] CORS returns correct headers for allowed/denied origins
- [ ] SecureHeaders present on all responses
- [ ] Cookie encryption/decryption transparent to application code
- [ ] All middleware have complete unit tests
```

---

**CARP-063** `[Performance]` Profiler & Debugbar  
**Points:** 5 | **Priority:** Low

```
Technical Spec:
- Profiler middleware records: route, queries (count, time), cache hits/misses,
  memory usage, total request time
- Debug toolbar: injected into HTML responses in debug mode
- X-Carpenter-Profile response header with JSON summary

Acceptance Criteria:
- [ ] Profiler collects data via events (not tight coupling)
- [ ] Debug toolbar injected only when APP_DEBUG=true
- [ ] Query count and total query time tracked per request
- [ ] Cache hit/miss ratio tracked per request
- [ ] Full tests verifying profiler data collection
```

---

**CARP-064** `[Security]` Encryption & Hashing Services  
**Points:** 5 | **Priority:** High

```
Technical Spec:
- Encrypter: encrypt(data): string (AES-256-GCM, HMAC-signed, base64)
- Encrypter: decrypt(payload): data — throws if MAC invalid
- HashManager: adapters for bcrypt, argon2 — Strategy pattern
- encrypt() / decrypt() / hash() / checkHash() global helpers
- Key derived from APP_KEY in config

Acceptance Criteria:
- [ ] Encrypted payload tamper-evident (HMAC validation)
- [ ] Wrong APP_KEY fails decryption
- [ ] bcrypt and argon2 adapters working with correct cost parameters
- [ ] checkHash() timing-safe comparison
- [ ] Full tests including tamper detection
```

---

**Sprint 19 Total: 18 points**

---

### Sprint 20 — Docs, Examples, DX Polish & Release (E20)

**Sprint Goal:** Complete documentation, working example apps, npm publish, and final DX polish.

---

**CARP-065** `[E20]` API Documentation  
**Points:** 8 | **Priority:** High

```
Deliverables:
- Getting Started guide
- Full API reference for all public classes/methods (from TSDoc)
- Architecture guide (layer diagram, design patterns map)
- Database guide (adapters, ORM, migrations)
- Frontend guide (CarpenterUI + React/Vue adapters)
- Testing guide (all mocks, traits, HTTP client)
- Deployment guide (Bun, Node, Docker, Kubernetes)
- Contributing guide with SOLID/GoF checklist
```

---

**CARP-066** `[E20]` Example Applications  
**Points:** 8 | **Priority:** High

```
Examples:
1. Blog App (CarpenterUI)
   - Posts CRUD with categories and tags
   - Authentication (session-based)
   - Comments with real-time updates (WebSocket)
   - Image upload (Storage system)
   - Email notifications on comment

2. REST API Only
   - JWT authentication
   - Resource controllers
   - Rate limiting
   - API versioning

3. Fullstack with React
   - Same blog features using @formwork/ui-react
   - SSR with hydration

Acceptance Criteria:
- [ ] All three examples run with `bun run dev`
- [ ] All include full test suites
- [ ] All pass TypeScript strict mode
- [ ] README per example explains architecture decisions
```

---

**CARP-067** `[E20]` NPM Publishing & Release  
**Points:** 5 | **Priority:** High

```
Acceptance Criteria:
- [ ] All packages published to npm under @formwork/* scope
- [ ] Semantic versioning with changesets (changeset-action in CI)
- [ ] Each package has README, LICENSE (MIT), CHANGELOG
- [ ] Provenance attestation in npm publish
- [ ] create-carpenter-app works via npx
- [ ] GitHub release with full changelog on v1.0.0 tag
```

---

**Sprint 20 Total: 21 points**

---

## 7. Definition of Done

A story is **Done** when ALL of the following are true:

- [ ] **Code compiles** with `tsc --noEmit` in strict mode, zero errors
- [ ] **Linter passes** with zero ESLint/Biome errors or warnings
- [ ] **Tests pass** — all unit and integration tests for the story green
- [ ] **Coverage** — 90%+ line coverage for the changed code (100% for core/container)
- [ ] **No anti-patterns** — no raw `any`, no `as unknown as X` casts, no `// @ts-ignore`
- [ ] **SOLID reviewed** — PR description lists which SOLID principles apply and how they're followed
- [ ] **GoF documented** — JSDoc identifies any GoF patterns used
- [ ] **No circular deps** — `madge --circular` reports zero cycles
- [ ] **Mock isolation** — No test makes real I/O calls (no real DB, Redis, HTTP)
- [ ] **PR reviewed** — Reviewed by at least one other AI pass or human
- [ ] **Docs updated** — TSDoc on all exported symbols, README updated if API changed

---

## 8. Testing Strategy

### 8.1 Test Pyramid

```
         /\
        /e2e\         ← Few: full app flow tests (Playwright/TestHttpClient)
       /──────\
      /integr. \      ← Some: multi-layer tests (controller + middleware + mock DB)
     /────────────\
    /  unit tests  \  ← Many: single class, all mocks, fast
   /────────────────\
```

### 8.2 Test Categories Per Package

| Package | Unit | Integration | E2E |
|---------|------|-------------|-----|
| @formwork/core | ✅ | — | — |
| @formwork/container | ✅ | — | — |
| @formwork/http | ✅ | ✅ (TestApp) | — |
| @formwork/orm | ✅ (mock DB) | ✅ (SQLite) | — |
| @formwork/db-postgres | ✅ (mock pg) | ✅ (Docker) | — |
| @formwork/cache | ✅ (mock) | ✅ (Docker Redis) | — |
| @formwork/queue | ✅ (mock) | ✅ (BullMQ+Redis) | — |
| @formwork/auth | ✅ | ✅ (TestApp) | — |
| @formwork/padlock | ✅ | ✅ (TestApp) | — |
| @formwork/faker | ✅ | — | — |
| @formwork/ui | ✅ (JSDOM) | ✅ | ✅ (Playwright) |
| @formwork/testing | ✅ | — | — |

### 8.3 Mock Strategy

**Rule:** Every external service MUST have a mock in `@formwork/testing`. Tests that require external services run only in the `integration` test suite (CI, not local by default).

```typescript
// Example: All tests use mocks by default
import { MockDatabaseAdapter, MockCacheStore, MockQueueAdapter } from '@formwork/testing'

describe('UserService', () => {
  let app: TestApplication

  beforeEach(async () => {
    app = await TestApplication.create({
      db: new MockDatabaseAdapter(),
      cache: new MockCacheStore(),
      queue: new MockQueueAdapter(),
    })
  })
})
```

### 8.4 Coverage Thresholds

```json
{
  "coverageThreshold": {
    "global": { "lines": 90, "functions": 90, "branches": 85 },
    "packages/core/**": { "lines": 100 },
    "packages/container/**": { "lines": 100 },
    "packages/orm/src/query/**": { "lines": 95 }
  }
}
```

---

## 9. IoC Container Specification

### 9.1 Container Interface (ISP-split)

```typescript
// @formwork/core/contracts/container/IBindingRegistry.ts
interface IBindingRegistry {
  bind<T>(abstract: Token<T>, factory: Factory<T>): void
  singleton<T>(abstract: Token<T>, factory: Factory<T>): void
  instance<T>(abstract: Token<T>, value: T): void
  alias(abstract: Token, alias: Token): void
}

// @formwork/core/contracts/container/IResolver.ts
interface IResolver {
  make<T>(abstract: Token<T>): T
  makeWith<T>(abstract: Token<T>, params: Record<string, unknown>): T
  bound(abstract: Token): boolean
}

// @formwork/core/contracts/container/IScopeFactory.ts
interface IScopeFactory {
  scope(): IContainer
}

// IContainer extends all three — but consumers depend only on the interface they need (ISP)
interface IContainer extends IBindingRegistry, IResolver, IScopeFactory {}
```

### 9.2 Auto-Wiring Algorithm

```
make(Token):
  1. If instance registered → return instance
  2. If singleton registered and already resolved → return cached instance
  3. If factory registered → call factory(container) → return result
  4. If class token → reflect constructor params → recursively make() each → new Class(...resolved)
  5. If no binding and not a class → throw CarpenterContainerError('Unresolvable: ' + token)
```

### 9.3 Decorator Metadata Protocol

```typescript
@Injectable()          // Sets metadata: 'carpenter:injectable' = true
@Singleton()           // Sets metadata: 'carpenter:scope' = 'singleton'
@Inject(IUserRepo)     // Sets metadata: 'carpenter:inject:0' = IUserRepo (param 0)
class UserService {
  constructor(
    @Inject(IUserRepository) private readonly users: IUserRepository,
    @Inject(IHashManager)    private readonly hash: IHashManager,
  ) {}
}
```

---

## 10. Routing Specification

### 10.1 Route Types

```typescript
// Web routes — connect directly to CarpenterUI pages via bridge
// routes/web.ts
router.get('/', [HomeController, 'index'])              // renders view
router.resource('posts', PostController)                // full CRUD with UI
router.group({ middleware: ['auth'], prefix: '/dashboard' }, () => {
  router.get('/', [DashboardController, 'index'])
})

// API routes — returns JSON responses
// routes/api.ts
router.prefix('/api/v1').group(() => {
  router.apiResource('posts', ApiPostController)        // JSON API
  router.post('/auth/token', [AuthController, 'token']) // JWT endpoint
})
```

### 10.2 Route Model Binding

```typescript
// Implicit binding: parameter name matches model
router.get('/posts/:post', [PostController, 'show'])
// → Post.findOrFail(request.param('post')) auto-injected into controller

// Explicit binding
router.bind('post', (value) => Post.where('slug', value).firstOrFail())

// Custom resolution key
class Post extends BaseModel {
  static routeKeyName = 'slug'  // find by slug instead of id
}
```

---

## 11. Frontend Engine Specification

### 11.1 CarpenterUI Component Lifecycle

```
instantiate → setup() → onBeforeMount() → render() → patch DOM → onMounted()
                                                ↓
                             signal change → onBeforeUpdate() → re-render → patch → onUpdated()
                                                ↓
                             unmount → onBeforeUnmount() → remove from DOM → onUnmounted()
```

### 11.2 .carp File Sections

| Section | Required | Purpose |
|---------|----------|---------|
| `<script>` | Yes | Component logic (TypeScript) |
| `<script setup>` | Alt | Setup sugar syntax |
| `<template>` | Yes | HTML template with directives |
| `<style>` | No | Component CSS |
| `<style scoped>` | No | Scoped CSS (auto-prefixed) |

### 11.3 Template Directive Reference

| Directive | Purpose |
|-----------|---------|
| `{{ expr }}` | Text interpolation |
| `:prop="expr"` | Bind attribute/prop |
| `@event="handler"` | Event listener |
| `v-if="cond"` | Conditional rendering |
| `v-else-if` / `v-else` | Conditional branches |
| `v-for="item in list"` | List rendering (requires `:key`) |
| `v-model="signal"` | Two-way binding |
| `v-show="cond"` | Toggle visibility (CSS) |
| `v-html="raw"` | Raw HTML (XSS warning) |
| `ref="name"` | DOM/component reference |

---

## 12. Infrastructure Adapters Specification

### 12.1 Adapter Pattern Contract

Every infrastructure adapter MUST:

1. Implement its interface (`IDatabaseAdapter`, `ICacheStore`, etc.)
2. Be registered via a `ServiceProvider` (never `new`'d directly in application code)
3. Have a corresponding **Mock** in `@formwork/testing`
4. Accept its config through constructor injection (DIP)
5. Never throw raw errors — wrap in typed `CarpenterError` subclasses

```typescript
// Example adapter registration (DIP + OCP)
class DatabaseServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton(IDatabaseAdapter, () => {
      const driver = this.app.config<string>('database.default')
      return dbManager.resolve(driver)
    })
  }
}
```

### 12.2 Adapter Substitutability Matrix

| Interface | Implementations | Mock |
|-----------|----------------|------|
| `IDatabaseAdapter` | Postgres, MySQL, SQLite, MongoDB | `MockDatabaseAdapter` |
| `ICacheStore` | Redis, Memory, File, Null | `MockCacheStore` |
| `IQueueAdapter` | BullMQ, SQS, Database, Sync | `MockQueueAdapter` |
| `IMailAdapter` | SMTP, SES, Mailgun, Resend, Log, Array | `MockMailAdapter` |
| `IStorageAdapter` | Local, S3, GCS, Azure, Memory | `MockStorageAdapter` |
| `ISessionStore` | File, Database, Redis, Cookie, Memory | `MockSessionStore` |
| `IBroadcastAdapter` | Pusher, Ably, NativeWS | `MockBroadcastAdapter` |
| `IHashManager` | Bcrypt, Argon2 | `MockHashManager` |

---

## 13. Acceptance Criteria Per Epic

### Epic Completion Checklist

| Epic | Done When |
|------|-----------|
| E01 Monorepo | All packages scaffold, CI green, zero circular deps |
| E02 IoC | Container resolves arbitrarily nested deps; decorators work; scoping works |
| E03 Kernel | App boots → handles request → returns response end-to-end |
| E04 HTTP | All HTTP methods, groups, middleware, sessions, exceptions work |
| E05 ORM | All CRUD + relations + migrations + seeders + factories + faker working |
| E06 DB Adapters | Postgres, MySQL, SQLite all pass integration tests |
| E07 Cache | Redis + Memory adapters; remember(), tags() working |
| E08 Queue | Jobs dispatched, processed, failed with BullMQ + Sync adapters |
| E09 Mail | Mail sent via SMTP + SES; Mail.fake() works in tests |
| E10 Storage | Local + S3 adapters; put, get, delete, url, temporaryUrl |
| E11 Auth | Session guard + JWT guard; policies + Gate + Padlock workflows working |
| E12 Validation | All rules; FormRequest; nested/array validation |
| E13 Events | Dispatch, listen, queue listeners, EventFake working |
| E14 CarpenterUI | SSR + CSR + hydration; .carp compiler; signals; router |
| E15 UI Bridge | Web route → UI page rendering via bridge protocol |
| E16 UI Adapters | React + Vue adapters ship with working tests |
| E17 Testing | TestApp, TestHttpClient, all mocks, faker integration, all traits work |
| E18 CLI | All make:* generators produce valid TypeScript; migrate/serve/build work |
| E19 Resilience | Circuit breaker, retry, rate limiter functional with tests |
| E20 Release | Docs complete, 3 example apps work, NPM packages published |

---

## Appendix A — Sprint Velocity Summary

| Sprint | Focus | Points |
|--------|-------|--------|
| 1 | Monorepo + IoC Container | 31 |
| 2 | App Kernel + HTTP Basics | 29 |
| 3 | Router + HTTP Kernel Complete | 23 |
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
| 20 | Docs + Examples + Release | 21 |
| **TOTAL** | | **~457 points** |

---

## Appendix B — AI Build Instructions

> **For Codex / Claude executing this plan:**

1. **Execute stories strictly in Sprint order.** Sprint N stories may depend on Sprint N-1.
2. **Before writing any class**, write the interface it implements in `contracts/`.
3. **Every constructor parameter** must be an interface type, resolved by the IoC container.
4. **Every test file** must import from `@formwork/testing` for infrastructure — never instantiate real adapters.
5. **After each story**, run `bun test` and `tsc --noEmit` — only proceed if both pass.
6. **File header JSDoc** is mandatory on every new file:
   ```typescript
   /**
    * @module @formwork/[package]
    * @description [One sentence description]
    * @patterns [List GoF patterns used]
    * @principles [List SOLID principles demonstrated]
    */
   ```
7. **When in doubt about architecture**: refer to Section 3 (Design Principles) and prefer the simpler solution (KISS) that is still extensible (OCP).
8. **Never use `any`** — use generics, `unknown` with narrowing, or proper typing.
9. **All async code** uses `async/await` — no raw Promise chains except in low-level adapters.
10. **All public APIs** have TSDoc comments with `@param`, `@returns`, `@throws`, `@example`.

---

*Carpenter Framework SCRUM Plan v1.0.0 — Generated for AI-assisted implementation*  
*License: MIT | Runtime: Bun ≥1.1 / Node.js ≥20 | Language: TypeScript 5.x*
