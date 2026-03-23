import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Canonical source aliases
      { find: /^@carpentry\/formworks\/(.*)$/, replacement: fromRoot("./src/$1") },

      // Tier-1 modules in formworks/src
      { find: /^@carpentry\/(core|http|foundation|auth|orm|db|validation|events|session|log|cache|queue|mail|storage|bridge|resilience|scheduler|flags|notifications|tenancy|i18n|ui|helpers|http-client|media|encrypt|testing|faker|crypto|number|pipeline)(?:\/(.*))?$/, replacement: fromRoot("./src/$1/$2") },

      // Tier-2 package aliases
      { find: /^@carpentry\/(ai|admin|analytics|audit|billing|broadcasting|edge|graphql|health|mcp|otel|padlock|pdf|excel|geo|realtime|search|sociallock|wasm|webhook)(?:\/(.*))?$/, replacement: fromRoot("./packages/$1/src/$2") },

      // Adapter package aliases
      { find: /^@carpentry\/bridge-(grpc|kafka|nats)(?:\/(.*))?$/, replacement: fromRoot("./packages/bridge-adapters/$1/src/$2") },
      { find: /^@carpentry\/cache-(memcached|redis)(?:\/(.*))?$/, replacement: fromRoot("./packages/cache-adapters/$1/src/$2") },
      { find: /^@carpentry\/db-(filesystem|mongodb|mysql|postgres|sqlite|turso)(?:\/(.*))?$/, replacement: fromRoot("./packages/db-adapters/$1/src/$2") },
      { find: /^@carpentry\/db-memory(?:\/(.*))?$/, replacement: fromRoot("./packages/db-adapters/memorydb/src/$1") },
      { find: /^@carpentry\/mail-(http|smtp)(?:\/(.*))?$/, replacement: fromRoot("./packages/mail-adapters/$1/src/$2") },
      { find: /^@carpentry\/queue-(bullmq|database|sqs)(?:\/(.*))?$/, replacement: fromRoot("./packages/queue-adapters/$1/src/$2") },
      { find: /^@carpentry\/storage-(azure|gcs|s3)(?:\/(.*))?$/, replacement: fromRoot("./packages/storage-adapters/$1/src/$2") },
    ],
  },
  test: {
    include: [
      "tests/**/*.test.ts",
      "packages/**/tests/**/*.test.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95
      }
    }
  }
});
