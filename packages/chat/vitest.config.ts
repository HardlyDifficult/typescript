import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Use forks pool for better isolation and cleanup
    pool: 'forks',
    // Properly isolate tests
    isolate: true,
    // Pass through for ESM
    passWithNoTests: false,
  },
});
