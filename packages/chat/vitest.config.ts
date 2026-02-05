import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Use threads pool for faster tests
    pool: 'threads',
    // Fail if no tests are found
    passWithNoTests: false,
    // Shorter teardown timeout
    teardownTimeout: 500,
    // Maximum time for test lifecycle hooks (beforeEach, afterEach, etc.)
    hookTimeout: 5000,
  },
});
