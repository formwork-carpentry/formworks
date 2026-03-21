# Carpenter Framework

A Laravel-inspired full-stack TypeScript framework. 36 packages. 1,722 tests. 4 production starters.

## Quick Start

```bash
git clone <repo> carpenter && cd carpenter
npm install

# Start a starter (pick one):
tsx starters/api-starter/src/server.ts         # REST API on :3000
tsx starters/blog-starter/src/server.ts        # Blog on :3001
tsx starters/saas-starter/src/server.ts        # Multi-tenant SaaS on :3002
tsx starters/fullstack-starter/src/server.ts   # Laravel-style fullstack on :3003
```

Try it:

```bash
curl http://localhost:3000/health
# {"status":"ok","app":"API Starter","timestamp":"..."}

curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"password123"}'
# {"data":{"name":"Alice"},"token":"eyJhbGci..."}

curl http://localhost:3000/api/weather/london
# {"data":{"city":"london","temperature":12,"conditions":"partly cloudy",...}}

curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" -d '{"title":"X"}'
# {"errors":{"title":["must be at least 3"],"body":["required"],"category":["required"]}}
```

## Starters

| Starter | Files | Features |
|---------|-------|----------|
| **api-starter** | 10 | JWT auth, validation, ORM CRUD, cache tags, events, weather + exchange API with circuit breaker |
| **blog-starter** | 8 | Session auth, i18n (EN/FR), posts + comments, real-time broadcast, quote API with circuit breaker |
| **saas-starter** | 9 | Multi-tenancy, JWT, feature flags (free/pro/enterprise), billing, scoped cache, analytics API |
| **fullstack-starter** | 12 | Laravel file structure, .env config, Controllers/Models/Services/Events, i18n, weather API |

Every starter has `.env`, `server.ts`, and `package.json` with `npm run dev`.

## 36 Packages

Core: core, http, orm, validation, events, cache, queue, mail, storage, auth, session, i18n, helpers, foundation, resilience, scheduler, notifications, realtime, log, db

Advanced: ai, mcp, graphql, edge, otel, tenancy, admin, billing, media, flags, wasm, bridge, http-client, testing, ui, cli

Scaffolding: create-carpenter-app

## Key Patterns

```typescript
// Active Record ORM
const post = await Post.create({ title: 'Hello', body: '...', status: 'draft' });
const posts = await Post.query().where('status', '=', 'published').get();

// Validation
const result = validator.validate(body, { email: 'required|email', password: 'required|min:8' });

// Cache with tags
const posts = await cache.tags(['posts']).remember('posts:all', 300, () => Post.query().get());
await cache.tags(['posts']).flush();

// Events
await events.dispatch('user.registered', { userId: user.id });

// Circuit breaker + retry
const data = await breaker.execute(() =>
  retry(async () => fetchApi(url), { maxAttempts: 3, strategy: 'exponential' })
);

// i18n
translator.get('auth.welcome', { name: 'Alice' }); // "Welcome back, Alice!"

// Multi-tenancy
const scopedCache = new TenantCacheScope(cache, tenant);

// ISR
const page = await isr.handle('/post/1', () => ({ body: html, tags: ['posts'] }));
isr.purgeTag('posts');
```

## Running Tests

```bash
npx vitest run    # 1,722 tests
```

## Docs

- Docs index: `docs/README.md`
- Quick snippets: `docs/EXAMPLES-SNIPPETS.md`
- Full runnable apps: `examples/`

The framework keeps both: docs for fast copy/paste onboarding, examples for executable reference and CI smoke coverage. Planning, status, and audit documents now live under `docs/` instead of the repository root.

## Example Guide

Open these first if you want a runnable reference for a specific feature:

| Feature | Example |
|---|---|
| Minimal HTTP kernel | `examples/minimal-api/src/app.ts` |
| Auth + validation | `examples/api-only/src/app.ts` |
| ORM + REST API | `examples/blog-api/src/app.ts` |
| Database manager | `examples/database-example/src/app.ts` |
| Queue workflows | `examples/queue-example/src/app.ts` |
| Mail flows | `examples/mail-example/src/app.ts` |
| Storage disks | `examples/storage-example/src/app.ts` |
| Realtime collaboration | `examples/realtime-collab/src/app.ts` |
| AI agent + RAG | `examples/ai-assistant/src/app.ts` |
| GraphQL API | `examples/graphql-api/src/app.ts` |
| Edge runtime | `examples/edge-app/src/app.ts` |
| Multi-tenancy | `examples/saas/src/app.ts` |

## Conventions

- `ObjectLoader`: `locale -> namespace -> { key: value }`. Call `loadAll()` before `get()`.
- `BaseModel.query().first()` returns plain objects. Use `attr(obj, 'field')` or `BaseModel.find(id)`.
- `EventDispatcher.dispatch()` and `.emit()` both work.
- `RouteHandler` types first param as `IRequest`.
- `bootstrap()` auto-wires `BaseModel.adapter`.
