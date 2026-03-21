import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@formwork/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@formwork/faker': path.resolve(__dirname, '../faker/src/index.ts'),
    },
  },
});
