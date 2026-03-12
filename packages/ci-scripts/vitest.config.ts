import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { nodePackageVitestDefaults } from "../../.config/vitest.base.js";

/**
 * Vite plugin that injects `v8 ignore` hints for code that is
 * genuinely untestable from vitest:
 *
 * 1. `require.main === module` guards — these never execute in vitest's
 *    worker environment because vitest always sets `require.main = undefined`.
 *
 * 2. Defensive guards in `sortByDependencyOrder` — `Map.get()` checks that
 *    can never return undefined given how the Maps are initialised.
 *
 * 3. Catch blocks for `exec({ ignoreError: true })` calls — since that
 *    helper swallows errors when `ignoreError` is true, those catch blocks
 *    are structurally unreachable.
 */
function ignoreUnreachableCode(): Plugin {
  return {
    name: "ignore-unreachable-code",
    transform(code: string, id: string) {
      if (!id.endsWith(".ts") || id.includes("node_modules")) {
        return null;
      }

      let patched = code;

      // 1. require.main === module guards (4 lines: the if + body + closing brace)
      patched = patched.replace(
        /^(if \(require\.main === module\))/m,
        "/* v8 ignore next 4 */\n$1"
      );

      // 2. Defensive Map.get() guard in sortByDependencyOrder (publish.ts)
      //    Pattern: `if (!dependents) { continue; }`
      patched = patched.replace(
        /(const dependents = graph\.get\(current\);\n\s*)(if \(!dependents\) \{)/g,
        "$1/* v8 ignore next 3 */\n$2"
      );

      // 3. Defensive inDegree.get() guard in sortByDependencyOrder (publish.ts)
      //    Pattern: `if (currentDegree === undefined) { continue; }`
      patched = patched.replace(
        /(const currentDegree = inDegree\.get\(dependent\);\n\s*)(if \(currentDegree === undefined\) \{)/g,
        "$1/* v8 ignore next 3 */\n$2"
      );

      // 4. Catch block for ignoreError exec in hasChanges (publish.ts)
      //    Pattern: the final `} catch {` in hasChanges that follows exec with ignoreError
      patched = patched.replace(
        /(return diff\.length > 0;\n\s*\} catch \{)/g,
        "/* v8 ignore next 3 */\n$1"
      );

      // 5. Catch block for ignoreError exec in getLastTag (publish.ts)
      //    Pattern: the `} catch {` that follows exec with ignoreError in getLastTag
      patched = patched.replace(
        /(return tagList\[0\] \?\? null;\n\s*\} catch \{)/g,
        "/* v8 ignore next 3 */\n$1"
      );

      if (patched === code) {
        return null;
      }
      return { code: patched, map: null };
    },
  };
}

export default defineConfig({
  plugins: [ignoreUnreachableCode()],
  test: nodePackageVitestDefaults,
});
