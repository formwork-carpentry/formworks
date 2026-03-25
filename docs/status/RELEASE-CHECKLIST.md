
# Carpenter Framework Release Checklist

**Navigation:**
- [Milestone Closure Matrix](MILESTONE-CLOSURE-MATRIX.md)
- [Remaining Work](REMAINING-WORK.md)

Last updated: March 21, 2026

Use this checklist as the operational companion to `MILESTONE-CLOSURE-MATRIX.md`.

## Status Values

- Ready: can be executed now in this workspace.
- Validated: executed in this workspace and matched the expected result.
- Blocked: executed in this workspace and failed due to a verified code or tooling issue.
- Deferred: requires external infrastructure, credentials, or deployment targets.

## Verification Checklist

| Area | Owner | Command | Expected Output | Status |
|---|---|---|---|---|
| Standardized domain suites | Engineering | `npx vitest run packages/cache/tests/cache.test.ts packages/cache/tests/tagged-cache.test.ts packages/queue/tests/queue.test.ts packages/mail/tests/mail.test.ts packages/storage/tests/storage.test.ts packages/storage/tests/s3.test.ts packages/db/tests/database-manager.test.ts packages/db/tests/db-driver-packages.test.ts` | All tests pass with `0 failed` | Validated |
| Example smoke coverage | Engineering | `npx vitest run tests/examples.test.ts tests/examples-catalog.test.ts` | All retained examples import and bootstrap successfully | Validated |
| Starter smoke coverage | Engineering | `npx vitest run tests/starters.test.ts` | All starters bootstrap successfully | Validated |
| Repo typecheck gate | Engineering | `npm run typecheck` | All package typechecks succeed | Validated |
| Repo lint gate | Engineering | `npm run lint` | All package lint scripts succeed | Validated |
| Repo test gate | Engineering | `npm run test` | All workspace package builds and tests succeed | Validated |
| Docs snippet coverage | DX | Review `docs/EXAMPLES-SNIPPETS.md` | Snippets exist for platform, data, realtime, AI, GraphQL, edge, multitenancy | Ready |
| Example discovery | DX | Review `README.md` | `Example Guide` section maps features to runnable apps | Ready |

## Verified Blockers

No active release-gate blockers were observed in the latest validation run.

Validated on March 21, 2026:
- `npm run lint` passed across all lint-enabled workspace packages.
- `npm run typecheck` passed across all in-scope workspace packages.
- `npm run test` passed, including Docker lifecycle validation and integration suites (`22 passed`, `0 failed`).

Observed non-gating warnings during integration tests:
- KafkaJS startup/rebalance warnings during `tests/real-services.test.ts` did not fail tests.
- Node emitted a `TimeoutNegativeWarning` while Kafka integration retries were in progress; tests still passed.

## Release Artifacts

| Artifact | Owner | Check | Expected Result | Status |
|---|---|---|---|---|
| Milestone closure record | Engineering | Review `MILESTONE-CLOSURE-MATRIX.md` | Done / in-progress / deferred items explicitly documented | Ready |
| Remaining-work triage | Engineering | Review `REMAINING-WORK.md` | Only infrastructure-bound or explicit follow-up items remain | Ready |
| JSDoc / terminology standards | DX | Review `docs/JSDOC-STANDARDS.md` | Unified vocabulary documented and active | Ready |

## Deferred Release Gates

| Area | Owner | Why Deferred |
|---|---|---|
| Real Postgres/MySQL integration validation | Engineering | Needs Docker-backed database services |
| Transport adapter integration validation | Engineering | Needs gRPC/NATS/Kafka infrastructure and external packages |
| Security audit / SBOM generation | Security | Needs audit tooling and running deployment target |
| Load / chaos validation | SRE | Needs k6, fault injection environment, and target services |
| Docs website publish | DX | Needs docs hosting and deployment workflow |
| npm publish / GA release | Release | Needs registry credentials, CI release pipeline, and versioning flow |
