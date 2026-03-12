import { defineConfig } from "vitest/config";

import { nodePackageVitestDefaults } from "../../.config/vitest.base.js";

export default defineConfig({
  test: {
    ...nodePackageVitestDefaults,
    coverage: {
      // Exclude pure barrel/re-export files that contain no executable logic
      exclude: ["src/index.ts", "src/markdown.ts"],
    },
  },
});
