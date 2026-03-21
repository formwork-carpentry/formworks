import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: {
    alias: {
      '@formwork/db-memory': '../../packages/db-adapters/memorydb/src/index.ts',
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.ts',
        'sqlite/src/**/*.ts',
        'postgres/src/**/*.ts',
        'mysql/src/**/*.ts',
        'mongodb/src/**/*.ts',
      ],
      // Type-only files are erased at runtime; they shouldn't prevent functional coverage.
      exclude: ['src/types.ts', 'src/index.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        // SQLiteMemoryAdapter is a small in-memory SQL interpreter; some branches
        // are intentionally hard to reach in unit tests without overfitting.
        branches: 75,
      },
    },
  },
});
