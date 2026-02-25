import { defineConfig } from "vitest/config";

import { nodePackageVitestDefaults } from "../../.config/vitest.base.js";

export default defineConfig({
  test: nodePackageVitestDefaults,
});
