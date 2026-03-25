
# Carpenter Framework — Security Audit Report

**Navigation:**
- [Milestone Closure Matrix](../status/MILESTONE-CLOSURE-MATRIX.md)
- [Release Checklist](../status/RELEASE-CHECKLIST.md)
- [Remaining Work](../status/REMAINING-WORK.md)

**Audit date:** 2026-03-21
**Auditor:** Automated + Manual review
**Scope:** All 36 packages + 4 starters + create-carpenter-app
**npm audit:** 0 vulnerabilities (446 total dependencies: 311 prod, 100 dev, 86 optional)

---

## Executive Summary

The core framework packages (`packages/`) have **solid security primitives** — parameterized DB queries, hardcoded HS256 JWT algorithm (immune to alg:none), `timingSafeEqual` in password hash comparison, CSRF token generation with `crypto.randomBytes(32)`, XSS-safe `escapeAttr()` in the Island renderer, and a well-configured `SecureHeadersMiddleware`.

Critical and high findings are concentrated in **starter templates** (demo code), not the core framework. Action items below.

---

## Dependency Scan

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 0     |
| Moderate | 0     |
| Low      | 0     |
| **Total** | **0** |

---

## OWASP Top 10 Coverage

### A01:2021 — Broken Access Control ✅
- `@carpentry/padlock` provides authentication guards
- `@carpentry/admin` has role-based resource access
- Gate/Policy system in starters for fine-grained authorization

### A02:2021 — Cryptographic Failures ⚠️
- **Finding:** `HashManager` ships only SHA-256 driver; no bcrypt/argon2/scrypt built-in.
  - **Mitigation:** Documentation advises bcrypt/argon2 in production. Framework supports custom hash drivers.
- **Finding:** Starter `.env` files contain placeholder secrets (e.g., `JWT_SECRET=change-me-*`).
  - **Mitigation:** `.env.example` pattern; `.gitignore` covers `.env` at root.
- **Finding:** `temporaryUrl()` in `LocalStorageAdapter` uses unsigned `?expires=` parameter.
  - **Severity:** Low — easily extended by modifying query param.

### A03:2021 — Injection ✅
- All DB adapters use parameterized queries (`?` bindings) — no SQL injection vectors.
- `IslandRenderer.escapeAttr()` escapes `& " < >` in HTML attribute output.
- `new Function()` in MongoDB/SQLite driver loaders uses hardcoded specifier only.

### A04:2021 — Insecure Design ⚠️
- **Finding:** CORS default origin is `"*"` in `CorsMiddleware`.
  - **Mitigation:** `credentials: false` by default; restrictive config recommended in docs.
- **Finding:** Rate limiter keyed on `x-forwarded-for` — spoofable without trusted proxy.
  - **Mitigation:** Production should configure trusted proxy list.

### A05:2021 — Security Misconfiguration ✅
- `SecureHeadersMiddleware` sets X-Frame-Options, CSP, HSTS, X-Content-Type-Options.
- `security-audit` CLI command checks APP_KEY length and JWT_SECRET defaults.

### A06:2021 — Vulnerable and Outdated Components ✅
- `npm audit` returns 0 vulnerabilities across all 446 dependencies.

### A07:2021 — Identification and Authentication Failures ⚠️
- **Finding (Starter):** Plaintext password comparison in `api-starter` and `blog-starter` login routes.
  - **Severity:** Critical in production use — demo-only pattern.
  - **Remediation:** Starters should use `HashManager.check()`.
- **Finding (Starter):** Hardcoded JWT secret in `AuthController.ts` source code.
  - **Severity:** Critical if deployed as-is.
  - **Remediation:** Read from `process.env['JWT_SECRET']` with no fallback.
- **Positive:** JwtGuard hardcodes HS256 — immune to alg:none attacks.

### A08:2021 — Software and Data Integrity Failures ✅
- CSRF token generation uses `crypto.randomBytes(32)`.
- **Finding:** `verifyToken()` uses plain `===` comparison instead of `timingSafeEqual`.
  - **Severity:** Medium — enables theoretical timing-based CSRF extraction.

### A09:2021 — Security Logging and Monitoring Failures ✅
- `@carpentry/log` with multiple channels (console, file, array).
- `@carpentry/otel` for distributed tracing via Jaeger.
- `AuditLogger` tracks admin/data operations.
- Activity log table in database migrations.

### A10:2021 — Server-Side Request Forgery (SSRF) ✅
- External API calls in `AnalyticsService` use hardcoded mock — no user-controlled URLs.
- `@carpentry/http-client` wraps fetch() — consumers must validate URLs.

---

## Detailed Findings

### CRITICAL

| ID | File | Finding | Status |
|----|------|---------|--------|
| SEC-001 | `starters/api-starter/src/controllers/AuthController.ts` | Hardcoded JWT secret in source | Demo pattern — documented |
| SEC-002 | `starters/api-starter/src/controllers/AuthController.ts` | Plaintext password comparison | Demo pattern — documented |
| SEC-003 | `starters/blog-starter/src/routes/auth.ts` | Plaintext password comparison | Demo pattern — documented |

### HIGH

| ID | File | Finding | Status |
|----|------|---------|--------|
| SEC-004 | `starters/*/`.env | Placeholder secrets committed | Mitigated by .env.example pattern |
| SEC-005 | `starters/fullstack-starter/src/config/auth.ts` | Fallback to dummy OAuth creds if env unset | Fixed — throws on missing env |
| SEC-006 | `packages/session/src/index.ts` | CSRF verifyToken uses `===` not timingSafeEqual | Documented for v1.1 |

### MEDIUM

| ID | File | Finding | Status |
|----|------|---------|--------|
| SEC-007 | `packages/http/src/middleware/CorsMiddleware.ts` | Default origin `"*"` | By design — docs recommend restrictive config |
| SEC-008 | `packages/http/src/middleware/RateLimitMiddleware.ts` | In-memory store, x-forwarded-for keying | By design — Redis adapter available |
| SEC-009 | `packages/auth/src/hash/HashManager.ts` | SHA-256 only — no bcrypt/argon2 | Custom driver support documented |
| SEC-010 | `packages/db-adapters/mongodb/src/helpers/driverLoader.ts` | `new Function()` for dynamic import | Hardcoded specifier — not exploitable |

### LOW

| ID | File | Finding | Status |
|----|------|---------|--------|
| SEC-011 | `packages/storage/src/adapters/LocalStorageAdapter.ts` | Unsigned temporaryUrl | Documented for v1.1 (HMAC signing) |
| SEC-012 | `packages/ai/src/Agent.ts` | `eval()` in JSDoc example | Documentation only |

---

## Positive Security Posture

- **0 npm vulnerabilities** across 446 dependencies
- **Parameterized queries** in all DB adapters (no SQL injection)
- **HS256-only JWT** (alg:none immune)
- **`timingSafeEqual`** in HashManager password comparison
- **CSRF token** generation with `crypto.randomBytes(32)`
- **XSS protection** via `escapeAttr()` in Island renderer
- **Security headers** (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
- **Rate limiting** middleware with configurable sliding window
- **Audit logging** via `AuditLogger` + activity_log DB table
- **OpenTelemetry** integration for distributed tracing
- **Security audit CLI** (`carpenter security:audit`) checks common misconfigurations

---

## Recommendations for v1.1

1. Add HMAC-signed temporary URLs in `LocalStorageAdapter`
2. Use `timingSafeEqual` in CSRF `verifyToken()`
3. Ship bcrypt hash driver as `@carpentry/auth-bcrypt` adapter
4. Add trusted proxy configuration to rate limiter
5. Default CORS origin to `null` (require explicit configuration)
6. Enforce minimum JWT secret length (≥32 chars) at guard construction
