# Carpenter Framework Milestone Closure Matrix

Last updated: March 20, 2026

This matrix converts the active plan, Scrum documents, and remaining-work backlog into a concrete closure artifact.

## Status Legend

- Done: implemented and backed by current code or tests in this workspace.
- In Progress: partially implemented, with visible code and validation evidence, but not yet complete at milestone level.
- Deferred: intentionally left for external infrastructure, packaging, or non-sandbox execution.

## Phase 1: Architecture Standardization

| Area | Status | Evidence | Notes |
|---|---|---|---|
| DB manager vocabulary | Done | `packages/db/src/adapters/databaseManager.ts`, `packages/db/src/factory/index.ts`, `packages/db/tests/database-manager.test.ts` | Canonicalized to `DatabaseManager` / `createDatabaseManager`. |
| Cache manager barrel parity | Done | `packages/cache/src/index.ts`, `packages/cache/src/manager/index.ts` | Root exports now route through manager barrel. |
| Queue manager barrel parity | Done | `packages/queue/src/index.ts`, `packages/queue/src/manager/index.ts` | Root exports now route through manager barrel. |
| Mail manager barrel parity | Done | `packages/mail/src/index.ts`, `packages/mail/src/manager/index.ts` | Root exports now route through manager barrel. |
| Storage manager barrel parity | Done | `packages/storage/src/index.ts`, `packages/storage/src/manager/index.ts` | Root exports now route through manager barrel. |
| Foundation wiring to manager APIs | Done | `packages/foundation/src/providers/DatabaseInfrastructureProvider.ts` | Provider now binds `createDatabaseManager`. |

## Phase 2: Examples And Docs Reality Pass

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Example import normalization to `@carpentry/*` | Done | `examples/*/src/app.ts`, `tests/examples.test.ts` | Example apps no longer rely on deep relative package imports. |
| Major domain examples retained | Done | `examples/database-example/src/app.ts`, `examples/mail-example/src/app.ts`, `examples/queue-example/src/app.ts`, `examples/storage-example/src/app.ts` | Real domain examples were added and smoke tested. |
| Example catalog integrity guardrail | Done | `tests/examples-catalog.test.ts`, `examples/packages/catalog.ts` | Catalog file references are enforced by test. |
| Docs snippets linked to runnable examples | Done | `docs/EXAMPLES-SNIPPETS.md`, `README.md` | Docs now cover platform, data, realtime, AI, GraphQL, edge, multitenancy. |
| README example discoverability | Done | `README.md` | README now includes a direct feature-to-example lookup table. |
| Interactive scaffolder prompts | Done | `create-carpenter-app/src/cli.ts`, `create-carpenter-app/tests/cli.test.ts` | Missing CLI inputs are now resolved interactively via built-in readline prompts. |

## Phase 3: Test Double Vocabulary And Conventions

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Unified terminology in docs | Done | `docs/JSDOC-STANDARDS.md` | Standardized `in-memory`, `test double`, `fake`, `stub`, `mock`. |
| Package comment normalization | Done | `packages/http-client/src/index.ts`, `packages/testing/src/index.ts`, `packages/mail/src/index.ts` | User-facing terminology aligned. |
| Example prose normalization | Done | `examples/packages/catalog.ts`, example app headers | Major examples now use consistent wording. |

## Phase 4: Scrum Closure Summary

| Source | Status | Evidence | Notes |
|---|---|---|---|
| Sprint 6 `CARP-022` DB manager contract | In Progress | `packages/db/src/adapters/databaseManager.ts`, `packages/db/tests/database-manager.test.ts` | Manager/factory architecture is standardized; full ORM-wide mock adapter adoption remains separate. |
| Sprint 6 `CARP-023` PostgreSQL adapter | Deferred | `REMAINING-WORK.md` | Requires real driver package and Docker-backed integration tests. |
| Sprint 6 `CARP-024` MySQL/SQLite adapters | In Progress | `packages/db-adapters/mysql`, `packages/db-adapters/sqlite`, `REMAINING-WORK.md` | In-memory and adapter package structure exist; real infra-backed completion remains deferred. |
| Sprints 21+ advanced epics | Deferred | `carpenter-framework-scrum-plan-part2.md`, `REMAINING-WORK.md` | Polyglot transports, AI expansion, observability, release infra require dedicated batches or external systems. |

## Phase 5: Hardening And Release Gates

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Scaffolder interaction hardening | Done | `create-carpenter-app/src/cli.ts`, `create-carpenter-app/tests/cli.test.ts` | Missing CLI inputs are resolved interactively and validated by targeted tests. |
| Billing repo-gate regression fix | Done | `packages/billing/src/provider.ts` | Cleared the first root `typecheck` blocker by importing `Money` and removing unused billing-only type imports. |
| Validation contract alignment | Done | `packages/core/src/contracts/validation/index.ts` | Shared validation interfaces now match the validator implementation (`name`, `validate`, richer `ValidationRules`, optional messages). |
| Internal dependency declaration cleanup | Done | `packages/validation/package.json`, `packages/auth/package.json`, `packages/cli/package.json`, `packages/edge/package.json`, `packages/events/package.json`, `packages/i18n/package.json`, `packages/resilience/package.json` | Workspace packages importing `@carpentry/core` now declare that dependency explicitly. |
| Repo-wide release gate verification | In Progress | `RELEASE-CHECKLIST.md` | Root gates were executed and documented, but the repo still has pre-existing typecheck and tooling blockers outside this session’s scope. |

## Explicit Deferred Items

These are not blocked by architecture inconsistency. They are deferred because they need infrastructure or release execution outside this workspace session.

| Deferred Item | Why Deferred | Source |
|---|---|---|
| Real Postgres/MySQL integration | Needs Docker and real DB services | `REMAINING-WORK.md` |
| gRPC/NATS/Kafka transport completion | Needs external packages, generators, and transport runtime validation | `REMAINING-WORK.md`, `carpenter-framework-scrum-plan-part2.md` |
| Security audit / SBOM / OWASP verification | Needs deployed or running app plus external tooling | `REMAINING-WORK.md` |
| Load testing / chaos work | Needs k6, Docker, fault injection environment | `REMAINING-WORK.md` |
| Docs website / TypeDoc / publish pipeline | Needs deployment and registry infrastructure | `REMAINING-WORK.md` |

## Verification Evidence

- Example smoke coverage: `tests/examples.test.ts`
- Starter smoke coverage: `tests/starters.test.ts`
- Catalog integrity: `tests/examples-catalog.test.ts`
- Scaffolder prompts: `create-carpenter-app/tests/cli.test.ts`
- Standardized domain suites:
  - `packages/cache/tests/cache.test.ts`
  - `packages/cache/tests/tagged-cache.test.ts`
  - `packages/queue/tests/queue.test.ts`
  - `packages/mail/tests/mail.test.ts`
  - `packages/storage/tests/storage.test.ts`
  - `packages/storage/tests/s3.test.ts`
  - `packages/db/tests/database-manager.test.ts`
  - `packages/db/tests/db-driver-packages.test.ts`