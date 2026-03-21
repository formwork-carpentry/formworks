import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      'create-carpenter-app/cli': path.resolve(__dirname, '../../create-carpenter-app/src/cli.ts'),
    },
  },
});
