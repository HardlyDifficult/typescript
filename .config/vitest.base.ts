import type { UserConfig } from "vitest/config";

export const nodePackageVitestDefaults: UserConfig["test"] = {
  globals: true,
  environment: "node",
  include: ["tests/**/*.test.ts"],
  pool: "threads",
  passWithNoTests: false,
  teardownTimeout: 500,
  hookTimeout: 5000,
};
