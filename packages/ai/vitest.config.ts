import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "threads",
    passWithNoTests: false,
    teardownTimeout: 500,
    hookTimeout: 5000,
  },
});
