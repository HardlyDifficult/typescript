import { defineConfig } from "vitest/config";

import { nodePackageVitestDefaults } from "../../.config/vitest.base.js";

export default defineConfig({
  test: {
    ...nodePackageVitestDefaults,
    coverage: {
      // Exclude StateTracker.ts line 306 defensive guard (envelope.value === undefined)
      // which is unreachable via standard JSON deserialization since JSON.parse()
      // cannot produce an object with a key present but value === undefined.
      exclude: [],
    },
  },
});
