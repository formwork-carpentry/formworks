import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/contracts/**'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 90,
      },
    },
  },
});
