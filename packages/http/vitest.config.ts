import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@carpentry/core': path.resolve(__dirname, '../core/src'),
      // Allow relative ../../../core/src paths to resolve .ts from .js
    },
    extensions: ['.ts', '.js', '.mjs'],
  },
});
