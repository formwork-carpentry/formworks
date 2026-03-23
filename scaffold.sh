#!/bin/bash
set -e

ROOT="/home/claude/carpenter"
cd "$ROOT"

# ============================================================
# 1. Root configuration files
# ============================================================

# --- Root package.json ---
cat > package.json << 'EOF'
{
  "name": "carpenter-framework",
  "version": "1.0.0-alpha.0",
  "private": true,
  "license": "MIT",
  "workspaces": [
    "packages/*",
    "packages/db-adapters/*",
    "packages/ui-adapters/*",
    "packages/bridge-adapters/*",
    "create-carpenter-app"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean",
    "dev": "turbo run dev"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "reflect-metadata": "^0.2.2",
    "@types/bun": "latest"
  }
}
EOF

# --- turbo.json ---
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "clean": {
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF

# --- tsconfig.base.json ---
cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["reflect-metadata"]
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
EOF

# --- biome.json ---
cat > biome.json << 'EOF'
{
  "$schema": "https://biomejs.dev/schemas/1.8.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      }
    }
  }
}
EOF

# ============================================================
# 2. Package scaffolding function
# ============================================================

scaffold_package() {
  local PKG_DIR="$1"
  local PKG_NAME="$2"
  local PKG_DESC="$3"

  mkdir -p "$ROOT/$PKG_DIR/src"
  mkdir -p "$ROOT/$PKG_DIR/tests"

  # package.json
  cat > "$ROOT/$PKG_DIR/package.json" << PKGEOF
{
  "name": "$PKG_NAME",
  "version": "1.0.0-alpha.0",
  "description": "$PKG_DESC",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "lint": "biome check src/"
  },
  "license": "MIT",
  "files": ["dist"]
}
PKGEOF

  # tsconfig.json
  cat > "$ROOT/$PKG_DIR/tsconfig.json" << TSEOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
TSEOF

  # Placeholder index.ts
  if [ ! -f "$ROOT/$PKG_DIR/src/index.ts" ]; then
    cat > "$ROOT/$PKG_DIR/src/index.ts" << IDXEOF
/**
 * @module $PKG_NAME
 * @description $PKG_DESC
 */
export {};
IDXEOF
  fi
}

# For nested packages (db-adapters, ui-adapters, bridge-adapters)
scaffold_nested_package() {
  local PKG_DIR="$1"
  local PKG_NAME="$2"
  local PKG_DESC="$3"

  mkdir -p "$ROOT/$PKG_DIR/src"
  mkdir -p "$ROOT/$PKG_DIR/tests"

  cat > "$ROOT/$PKG_DIR/package.json" << PKGEOF
{
  "name": "$PKG_NAME",
  "version": "1.0.0-alpha.0",
  "description": "$PKG_DESC",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "lint": "biome check src/"
  },
  "license": "MIT",
  "files": ["dist"]
}
PKGEOF

  cat > "$ROOT/$PKG_DIR/tsconfig.json" << TSEOF
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
TSEOF

  if [ ! -f "$ROOT/$PKG_DIR/src/index.ts" ]; then
    cat > "$ROOT/$PKG_DIR/src/index.ts" << IDXEOF
/**
 * @module $PKG_NAME
 * @description $PKG_DESC
 */
export {};
IDXEOF
  fi
}

# ============================================================
# 3. Scaffold ALL packages
# ============================================================

echo "Scaffolding Part I packages..."

# Core packages (Part I - Sprints 1-20)
scaffold_package "packages/core"       "@carpentry/core"       "Framework core: IoC container, config, env, exceptions, support utilities"
scaffold_package "packages/http"       "@carpentry/http"       "HTTP kernel, routing, request/response, middleware, controllers, sessions"
scaffold_package "packages/orm"        "@carpentry/orm"        "ORM: BaseModel, QueryBuilder, relations, migrations, seeders"
scaffold_package "packages/cache"      "@carpentry/cache"      "Cache manager with pluggable adapters (Redis, Memory, File, Null)"
scaffold_package "packages/queue"      "@carpentry/queue"      "Queue manager with pluggable adapters (BullMQ, SQS, Database, Sync)"
scaffold_package "packages/mail"       "@carpentry/mail"       "Mail manager with pluggable adapters (SMTP, SES, Mailgun, Resend)"
scaffold_package "packages/storage"    "@carpentry/storage"    "Storage manager with pluggable adapters (Local, S3, GCS, Azure)"
scaffold_package "packages/auth"       "@carpentry/auth"       "Authentication guards, authorization policies, Gate"
scaffold_package "packages/validation" "@carpentry/validation" "Validator, rules, FormRequest"
scaffold_package "packages/events"     "@carpentry/events"     "Event dispatcher, listeners, subscribers"
scaffold_package "packages/ui"         "@carpentry/ui"         "CarpenterUI: VDOM, .carp compiler, SSR, signals, client router"
scaffold_package "packages/testing"    "@carpentry/testing"    "Test application, HTTP client, all infrastructure mocks"
scaffold_package "packages/resilience" "@carpentry/resilience" "Circuit breaker, retry, rate limiter"
scaffold_package "packages/cli"        "@carpentry/cli"        "carpenter CLI: generators, migrations, serve, build"

# Database adapters
scaffold_nested_package "packages/db-adapters/postgres" "@carpentry/db-postgres" "PostgreSQL database adapter"
scaffold_nested_package "packages/db-adapters/mysql"    "@carpentry/db-mysql"    "MySQL database adapter"
scaffold_nested_package "packages/db-adapters/sqlite"   "@carpentry/db-sqlite"   "SQLite database adapter"
scaffold_nested_package "packages/db-adapters/mongodb"  "@carpentry/db-mongodb"  "MongoDB database adapter"

# UI adapters
scaffold_nested_package "packages/ui-adapters/react"  "@carpentry/ui-react"  "React adapter for Carpenter UI bridge"
scaffold_nested_package "packages/ui-adapters/vue"    "@carpentry/ui-vue"    "Vue 3 adapter for Carpenter UI bridge"
scaffold_nested_package "packages/ui-adapters/svelte" "@carpentry/ui-svelte" "Svelte adapter for Carpenter UI bridge"
scaffold_nested_package "packages/ui-adapters/solid"  "@carpentry/ui-solid"  "SolidJS adapter for Carpenter UI bridge"

echo "Scaffolding Part II packages..."

# Part II packages (Sprints 21-40)
scaffold_package "packages/bridge"         "@carpentry/bridge"         "Polyglot microservices bridge: service proxy, transport abstraction, CSDL"
scaffold_package "packages/edge"           "@carpentry/edge"           "Edge runtime adapters: CF Workers, Deno Deploy, Vercel Edge"
scaffold_package "packages/ai"             "@carpentry/ai"             "AI/LLM integration: providers, streaming, RAG, agents, MCP"
scaffold_package "packages/graphql"        "@carpentry/graphql"        "GraphQL: code-first schema, resolvers, DataLoader, federation"
scaffold_package "packages/otel"           "@carpentry/otel"           "OpenTelemetry: auto-instrumentation, traces, metrics, logging"
scaffold_package "packages/multi-tenancy"  "@carpentry/multi-tenancy"  "Multi-tenancy: tenant resolution, data isolation, lifecycle"
scaffold_package "packages/admin"          "@carpentry/admin"          "CarpenterAdmin: auto-generated CRUD panel"
scaffold_package "packages/wasm"           "@carpentry/wasm"           "WASM module loader with TypeScript bindings"
scaffold_package "packages/flags"          "@carpentry/flags"          "Feature flags and A/B experimentation"
scaffold_package "packages/realtime"       "@carpentry/realtime"       "Real-time: presence, CRDT collaboration, live cursors"
scaffold_package "packages/mcp"            "@carpentry/mcp"            "Model Context Protocol client and server"

# Bridge transport adapters
scaffold_nested_package "packages/bridge-adapters/grpc"  "@carpentry/bridge-grpc"  "gRPC transport adapter for polyglot bridge"
scaffold_nested_package "packages/bridge-adapters/nats"  "@carpentry/bridge-nats"  "NATS transport adapter for polyglot bridge"
scaffold_nested_package "packages/bridge-adapters/kafka" "@carpentry/bridge-kafka" "Kafka transport adapter for polyglot bridge"

# create-carpenter-app
mkdir -p "$ROOT/create-carpenter-app/src"
cat > "$ROOT/create-carpenter-app/package.json" << 'EOF'
{
  "name": "create-carpenter-app",
  "version": "1.0.0-alpha.0",
  "description": "Create a new Carpenter Framework application",
  "type": "module",
  "bin": { "create-carpenter-app": "./dist/index.js" },
  "scripts": { "build": "tsc -b" },
  "license": "MIT"
}
EOF

# Additional directories
mkdir -p "$ROOT/docs"
mkdir -p "$ROOT/examples/blog-app"
mkdir -p "$ROOT/examples/api-only"
mkdir -p "$ROOT/examples/fullstack-react"
mkdir -p "$ROOT/examples/polyglot-timetable"
mkdir -p "$ROOT/examples/saas-starter"
mkdir -p "$ROOT/examples/ai-assistant"
mkdir -p "$ROOT/examples/edge-app"
mkdir -p "$ROOT/protos"
mkdir -p "$ROOT/benchmarks"
mkdir -p "$ROOT/security"
mkdir -p "$ROOT/infra"

echo "✅ All 35+ packages scaffolded successfully"
