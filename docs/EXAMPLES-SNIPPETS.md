# Example Snippets

This page keeps quick, copy-paste snippets in docs while the full runnable apps stay in examples.

The snippets below are derived from runnable example apps that are covered by smoke tests.

## HTTP API Route Snippet

Source app: `examples/minimal-api/src/app.ts`

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

Source app: `examples/database-example/src/app.ts`

```ts
import { createDatabaseManager } from '@carpentry/db';

const dbManager = createDatabaseManager('memory', {
  memory: { driver: 'memory' },
});

const db = dbManager.connection();
```

## Queue Snippet

Source app: `examples/queue-example/src/app.ts`

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

Source app: `examples/mail-example/src/app.ts`

```ts
import { createMailManager, setMailManager, Mail } from '@carpentry/mail';

const mailManager = createMailManager('log', {
  log: { driver: 'log' },
  array: { driver: 'array' },
});

setMailManager(mailManager);
const mailTestDouble = Mail.fake();

await Mail.send({
  to: 'dev@example.com',
  subject: 'Hello from Carpenter',
  text: 'Captured by the in-memory mail test double.',
});

const sent = mailTestDouble.getSent();
```

## Storage Snippet

Source app: `examples/storage-example/src/app.ts`

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

## Realtime Snippet

Source app: `examples/realtime-collab/src/app.ts`

```ts
import { CollaborativeDoc } from '@carpentry/realtime';

const doc = new CollaborativeDoc('demo');
doc.insert(0, 'Hello', 'alice');
doc.insert(5, ' world', 'bob');

const text = doc.getText();
// Hello world
```

## AI Assistant Snippet

Source app: `examples/ai-assistant/src/app.ts`

```ts
import { Agent, AiGuard, RagPipeline, RecursiveChunker, InMemoryRagVectorStore } from '@carpentry/ai';
import type { IAIProvider } from '@carpentry/ai';

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

Source app: `examples/graphql-api/src/app.ts`

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

Source app: `examples/edge-app/src/app.ts`

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

Source app: `examples/saas/src/app.ts`

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
