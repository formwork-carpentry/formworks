
# Example Snippets

> **Quick Reference:** Copy-paste snippets for common patterns. All are derived from real, smoke-tested example apps in the `examples/` directory. For full runnable code, see the corresponding app in `examples/`.

---

**Navigation:**
- [HTTP API Route](#http-api-route-snippet)
- [Database Manager](#database-manager-snippet)
- [Queue](#queue-snippet)
- [Mail](#mail-snippet)
- [Storage](#storage-snippet)
- [Realtime Collaboration](#realtime-snippet)
- [AI Assistant](#ai-assistant-snippet)
- [GraphQL](#graphql-snippet)
- [Edge Runtime](#edge-runtime-snippet)
- [Multi-Tenancy](#multi-tenancy-snippet)

---


## HTTP API Route Snippet

_Source: `examples/minimal-api/src/app.ts`_

```ts
import 'reflect-metadata';
import { bootstrap } from '@carpentry/foundation';
import { Router, HttpKernel, CarpenterResponse } from '@carpentry/http';

export async function createApp() {
  const { container } = await bootstrap({
    skipEnv: true,
    configOverrides: { app: { name: 'Minimal API Example' } },
  });

  const router = new Router();
  router.get('/health', async () => CarpenterResponse.json({ status: 'ok' }));

  return new HttpKernel(container, router, { debug: true });
}
```


## Database Manager Snippet

_Source: `examples/database-example/src/app.ts`_

```ts
import { createDatabaseManager } from '@carpentry/db';

const dbManager = createDatabaseManager('memory', {
  memory: { driver: 'memory' },
});

const db = dbManager.connection();
```


## Queue Snippet

_Source: `examples/queue-example/src/app.ts`_

```ts
import { QueueManager } from '@carpentry/queue';

const queue = new QueueManager('memory', {
  memory: { driver: 'memory' },
});

queue.registerDriver('memory', () => ({
  enqueue: async () => ({ id: 'job-1' }),
  process: async () => undefined,
  pending: async () => 0,
  clear: async () => undefined,
}));
```


## Mail Snippet

_Source: `examples/mail-example/src/app.ts`_

```ts
import { createMailManager, setMailManager, Mail } from '@carpentry/mail';

const mailManager = createMailManager('log', {
  log: { driver: 'log' },
  array: { driver: 'array' },
});

setMailManager(mailManager);
// Use a test double for safe, inspectable mail testing
const mailTestDouble = Mail.fake();

await Mail.send({
  to: 'dev@example.com',
  subject: 'Hello from Carpenter',
  text: 'Captured by the in-memory mail test double.',
});

const sent = mailTestDouble.getSent();
```


## Storage Snippet

_Source: `examples/storage-example/src/app.ts`_

```ts
import { createStorageManager, setStorageManager, Storage } from '@carpentry/storage';

const storageManager = createStorageManager('memory', {
  memory: { driver: 'memory', baseUrl: '/files' },
});

setStorageManager(storageManager);
await Storage.put('docs/hello.txt', 'Hello from Carpenter storage');

const exists = await Storage.exists('docs/hello.txt');
const url = Storage.url('docs/hello.txt');
```


## Realtime Collaboration Snippet

_Source: `examples/realtime-collab/src/app.ts`_

```ts
import { CollaborativeDoc } from '@carpentry/realtime';

const doc = new CollaborativeDoc('demo');
doc.insert(0, 'Hello', 'alice');
doc.insert(5, ' world', 'bob');

const text = doc.getText(); // "Hello world"
```


## AI Assistant Snippet

_Source: `examples/ai-assistant/src/app.ts`_

```ts
import { Agent, AiGuard, RagPipeline, RecursiveChunker, InMemoryRagVectorStore } from '@carpentry/ai';
import type { IAIProvider } from '@carpentry/ai';

// Test double for AI provider
const aiTestDoubleProvider: IAIProvider = {
  getProviderName: () => 'mock',
  complete: async () => ({
    content: 'FINAL_ANSWER: I can help with that.',
    model: 'mock',
    usage: { inputTokens: 10, outputTokens: 15 },
    finishReason: 'stop',
    provider: 'mock',
  }),
};

const rag = new RagPipeline({
  chunker: new RecursiveChunker({ chunkSize: 200 }),
  vectorStore: new InMemoryRagVectorStore(),
  embedder: async (text: string) => [text.length],
});

const guard = new AiGuard({ detectPii: true, detectInjection: true });
const agent = new Agent({ provider: aiTestDoubleProvider, tools: [], maxSteps: 5 });
```


## GraphQL Snippet

_Source: `examples/graphql-api/src/app.ts`_

```ts
import { SchemaBuilder, ObjectType, Field, buildSchemaFromDecorators } from '@carpentry/graphql';

class User { id!: string; name!: string; email!: string; }
ObjectType({ description: 'A user' })(User);
Field('ID')(User.prototype, 'id');
Field('String')(User.prototype, 'name');
Field('String')(User.prototype, 'email');

const schema = new SchemaBuilder();
schema.type('User', { id: { type: 'ID' }, name: { type: 'String' }, email: { type: 'String' } });
schema.query('users', { type: '[User]', resolve: () => [{ id: '1', name: 'Alice', email: 'alice@test.com' }] });

const sdl = buildSchemaFromDecorators([User], []);
```


## Edge Runtime Snippet

_Source: `examples/edge-app/src/app.ts`_

```ts
import { EdgeKernel, edgeJson, edgeText, edgeCors } from '@carpentry/edge';

const kernel = new EdgeKernel();
kernel.use(edgeCors({ origin: '*' }));

kernel.get('/', async () => edgeText('Carpenter Edge App'));
kernel.get('/health', async () => edgeJson({
  status: 'ok',
  runtime: 'edge',
  routes: kernel.getRouteCount(),
}));

export { kernel };
```


## Multi-Tenancy Snippet

_Source: `examples/saas/src/app.ts`_

```ts
import { createCacheManager } from '@carpentry/cache';
import {
  InMemoryTenantStore,
  SubdomainResolver,
  TenancyManager,
  TenantCacheScope,
} from '@carpentry/tenancy';

const tenantStore = new InMemoryTenantStore();
await tenantStore.create({
  id: 'acme',
  name: 'Acme Corp',
  slug: 'acme',
  domain: 'acme.localhost',
  status: 'active',
});

const resolver = new SubdomainResolver();
const tenancy = new TenancyManager(tenantStore, resolver);
const globalCache = createCacheManager('memory', {
  memory: { driver: 'memory' },
}).store();
const tenant = await tenantStore.findBySlug('acme');

if (tenant) {
  const scopedCache = new TenantCacheScope(globalCache, tenant);
  await scopedCache.put('visits', 1);
}
```
