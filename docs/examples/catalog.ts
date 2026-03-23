/**
 * @module examples/packages/catalog
 * @description Machine-readable package-to-example coverage map for the Carpenter examples directory.
 */

export type ExampleDomain =
  | 'platform'
  | 'data'
  | 'auth'
  | 'frontend'
  | 'integration'
  | 'operations';

export type ExampleKind = 'starter-app' | 'package-recipe' | 'hybrid';

export interface PackageExampleCatalogEntry {
  packageName: string;
  domain: ExampleDomain;
  exampleKind: ExampleKind;
  files: readonly string[];
  summary: string;
}

const STARTERS = {
  aiAssistant: 'examples/ai-assistant/src/app.ts',
  apiOnly: 'examples/api-only/src/app.ts',
  blogApi: 'examples/blog-api/src/app.ts',
  blogApp: 'examples/blog-app/src/app.ts',
  databaseExample: 'examples/database-example/src/app.ts',
  edgeApp: 'examples/edge-app/src/app.ts',
  fullstackReact: 'examples/fullstack-react/src/app.ts',
  graphqlApi: 'examples/graphql-api/src/app.ts',
  mailExample: 'examples/mail-example/src/app.ts',
  mediaExample: 'examples/media-example/src/app.ts',
  minimalApi: 'examples/minimal-api/src/app.ts',
  polyglotTimetable: 'examples/polyglot-timetable/src/app.ts',
  queueExample: 'examples/queue-example/src/app.ts',
  realtimeCollab: 'examples/realtime-collab/src/app.ts',
  saas: 'examples/saas/src/app.ts',
  storageExample: 'examples/storage-example/src/app.ts',
} as const;

const GUIDES = {
  platform: 'examples/packages/platform-and-runtime.md',
  data: 'examples/packages/data-and-storage.md',
  auth: 'examples/packages/auth-and-application.md',
  frontend: 'examples/packages/frontend-and-content.md',
  integration: 'examples/packages/integration-and-services.md',
  operations: 'examples/packages/operations-and-multitenancy.md',
} as const;

export const PACKAGE_EXAMPLE_CATALOG: readonly PackageExampleCatalogEntry[] = [
  { packageName: '@carpentry/admin', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'Admin resources, field builders, and panel composition.' },
  { packageName: '@carpentry/ai', domain: 'integration', exampleKind: 'hybrid', files: [STARTERS.aiAssistant, GUIDES.integration], summary: 'Agent, guard, and RAG flows.' },
  { packageName: '@carpentry/formworks/auth', domain: 'auth', exampleKind: 'hybrid', files: [STARTERS.apiOnly, GUIDES.auth], summary: 'Guard-based authentication and session-backed auth.' },
  { packageName: '@carpentry/billing', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'In-memory billing provider, plans, and subscriptions.' },
  { packageName: '@carpentry/formworks/bridge', domain: 'integration', exampleKind: 'hybrid', files: [STARTERS.polyglotTimetable, GUIDES.integration], summary: 'Bridge transports and remote service calls.' },
  { packageName: '@carpentry/bridge-grpc', domain: 'integration', exampleKind: 'package-recipe', files: [GUIDES.integration], summary: 'gRPC bridge transport recipe.' },
  { packageName: '@carpentry/bridge-kafka', domain: 'integration', exampleKind: 'package-recipe', files: [GUIDES.integration], summary: 'Kafka bridge transport recipe.' },
  { packageName: '@carpentry/bridge-nats', domain: 'integration', exampleKind: 'package-recipe', files: [GUIDES.integration], summary: 'NATS bridge transport recipe.' },
  { packageName: '@carpentry/formworks/cache', domain: 'data', exampleKind: 'hybrid', files: [STARTERS.blogApi, STARTERS.blogApp, STARTERS.saas, GUIDES.data], summary: 'Cache manager, memory store, and cache usage in apps.' },
  { packageName: '@carpentry/cache-redis', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'Redis cache adapter wiring.' },
  { packageName: '@carpentry/cli', domain: 'platform', exampleKind: 'package-recipe', files: [GUIDES.platform], summary: 'CLI create/add/generate workflows.' },
  { packageName: 'create-carpenter-app', domain: 'platform', exampleKind: 'package-recipe', files: [GUIDES.platform], summary: 'Project scaffolding: npx create-carpenter-app my-app.' },
  { packageName: '@carpentry/formworks/core', domain: 'platform', exampleKind: 'hybrid', files: [STARTERS.minimalApi, GUIDES.platform], summary: 'Container, application lifecycle, and low-level runtime.' },
  { packageName: '@carpentry/formworks/db', domain: 'data', exampleKind: 'hybrid', files: [STARTERS.databaseExample, GUIDES.data], summary: 'Database manager and in-memory SQLite adapter.' },
  { packageName: '@carpentry/db-filesystem', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'Filesystem-backed document persistence.' },
  { packageName: '@carpentry/db-mongodb', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'MongoDB document adapter wiring.' },
  { packageName: '@carpentry/db-mysql', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'MySQL SQL adapter wiring.' },
  { packageName: '@carpentry/db-postgres', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'Postgres SQL adapter wiring.' },
  { packageName: '@carpentry/db-sqlite', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'SQLite adapter wiring.' },
  { packageName: '@carpentry/edge', domain: 'platform', exampleKind: 'hybrid', files: [STARTERS.edgeApp, GUIDES.platform], summary: 'Edge runtime and route handling.' },
  { packageName: '@carpentry/formworks/events', domain: 'operations', exampleKind: 'hybrid', files: [STARTERS.blogApi, STARTERS.blogApp, GUIDES.operations], summary: 'Event dispatcher and event-driven workflows.' },
  { packageName: '@carpentry/formworks/flags', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'Feature flags and in-memory flag provider.' },
  { packageName: '@carpentry/formworks/foundation', domain: 'platform', exampleKind: 'hybrid', files: [STARTERS.blogApi, STARTERS.apiOnly, STARTERS.fullstackReact, STARTERS.saas, GUIDES.platform], summary: 'Bootstrap and infrastructure provider composition.' },
  { packageName: '@carpentry/graphql', domain: 'integration', exampleKind: 'hybrid', files: [STARTERS.graphqlApi, GUIDES.integration], summary: 'Schema builder and code-first GraphQL.' },
  { packageName: '@carpentry/formworks/helpers', domain: 'operations', exampleKind: 'hybrid', files: [STARTERS.blogApi, STARTERS.apiOnly, GUIDES.operations], summary: 'String, array, and collection helpers.' },
  { packageName: '@carpentry/formworks/http', domain: 'platform', exampleKind: 'hybrid', files: [STARTERS.blogApi, STARTERS.apiOnly, STARTERS.minimalApi, GUIDES.platform], summary: 'Router, kernel, and response helpers.' },
  { packageName: '@carpentry/formworks/http-client', domain: 'integration', exampleKind: 'hybrid', files: [STARTERS.minimalApi, GUIDES.integration], summary: 'Outbound HTTP client and test-double transport.' },
  { packageName: '@carpentry/formworks/i18n', domain: 'frontend', exampleKind: 'hybrid', files: [STARTERS.fullstackReact, GUIDES.frontend], summary: 'Translation loaders, translator, and pluralization.' },
  { packageName: '@carpentry/formworks/log', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'Structured logging and audit channels.' },
  { packageName: '@carpentry/formworks/mail', domain: 'auth', exampleKind: 'hybrid', files: [STARTERS.mailExample, GUIDES.auth], summary: 'Mail manager and built-in in-memory test doubles.' },
  { packageName: '@carpentry/mail-http', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'HTTP mail adapter recipe.' },
  { packageName: '@carpentry/mail-smtp', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'SMTP mail adapter recipe.' },
  { packageName: '@carpentry/mcp', domain: 'integration', exampleKind: 'package-recipe', files: [GUIDES.integration], summary: 'In-memory MCP server and tool registration.' },
  { packageName: '@carpentry/formworks/media', domain: 'frontend', exampleKind: 'hybrid', files: [STARTERS.mediaExample, STARTERS.blogApp, GUIDES.frontend], summary: 'Media collections, transformations, document generation, and CSV export.' },
  { packageName: '@carpentry/formworks/notifications', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'Notification manager and channel routing.' },
  { packageName: '@carpentry/formworks/orm', domain: 'data', exampleKind: 'hybrid', files: [STARTERS.blogApi, STARTERS.blogApp, GUIDES.data], summary: 'BaseModel and query-driven data access.' },
  { packageName: '@carpentry/otel', domain: 'operations', exampleKind: 'hybrid', files: [STARTERS.polyglotTimetable, GUIDES.operations], summary: 'Tracer and metrics examples.' },
  { packageName: '@carpentry/padlock', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'Higher-level auth workflows and route/provider integration.' },
  { packageName: '@carpentry/sociallock', domain: 'auth', exampleKind: 'package-recipe', files: [GUIDES.auth], summary: 'OAuth 2.0 social login (Google, GitHub, Facebook).' },
  { packageName: '@carpentry/formworks/queue', domain: 'data', exampleKind: 'hybrid', files: [STARTERS.queueExample, GUIDES.data], summary: 'Queue manager and in-memory/sync adapters.' },
  { packageName: '@carpentry/queue-bullmq', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'BullMQ adapter wiring.' },
  { packageName: '@carpentry/realtime', domain: 'frontend', exampleKind: 'hybrid', files: [STARTERS.blogApp, STARTERS.realtimeCollab, GUIDES.frontend], summary: 'Broadcaster and collaborative document flows.' },
  { packageName: '@carpentry/formworks/resilience', domain: 'operations', exampleKind: 'hybrid', files: [STARTERS.minimalApi, STARTERS.polyglotTimetable, GUIDES.operations], summary: 'Retry, circuit breaker, and rate limiting patterns.' },
  { packageName: '@carpentry/formworks/scheduler', domain: 'operations', exampleKind: 'package-recipe', files: [GUIDES.operations], summary: 'Task scheduling and cron helpers.' },
  { packageName: '@carpentry/formworks/session', domain: 'data', exampleKind: 'hybrid', files: [STARTERS.blogApp, STARTERS.fullstackReact, GUIDES.data], summary: 'Session stores, flash data, and session facade.' },
  { packageName: '@carpentry/formworks/storage', domain: 'data', exampleKind: 'hybrid', files: [STARTERS.storageExample, GUIDES.data], summary: 'Storage manager and local/in-memory disks.' },
  { packageName: '@carpentry/storage-s3', domain: 'data', exampleKind: 'package-recipe', files: [GUIDES.data], summary: 'S3-compatible disk recipe.' },
  { packageName: '@carpentry/formworks/tenancy', domain: 'operations', exampleKind: 'hybrid', files: [STARTERS.saas, GUIDES.operations], summary: 'Tenant resolution and scoped execution.' },
  { packageName: '@carpentry/formworks/testing', domain: 'platform', exampleKind: 'package-recipe', files: [GUIDES.platform], summary: 'HTTP testing, test-double clocks, and benchmarking helpers.' },
  { packageName: '@carpentry/formworks/ui', domain: 'frontend', exampleKind: 'hybrid', files: [STARTERS.fullstackReact, GUIDES.frontend], summary: 'UI manager, page rendering, and islands.' },
  { packageName: '@carpentry/formworks/validation', domain: 'auth', exampleKind: 'hybrid', files: [STARTERS.blogApi, STARTERS.apiOnly, GUIDES.auth], summary: 'Validation rules and validator examples.' },
  { packageName: '@carpentry/wasm', domain: 'platform', exampleKind: 'package-recipe', files: [GUIDES.platform], summary: 'Managed WebAssembly loading.' },
] as const;
