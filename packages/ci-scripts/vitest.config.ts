import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { nodePackageVitestDefaults } from "../../.config/vitest.base.js";

/**
 * Vite plugin that injects `v8 ignore` hints for code that is
 * genuinely untestable from vitest.
 *
 * This plugin runs in the Vite transform pipeline AFTER esbuild has compiled
 * the TypeScript to JavaScript, so the patterns must match the compiled
 * JavaScript output (e.g. `undefined` is rewritten to `void 0` by esbuild).
 *
 * Untestable patterns:
 *
 * 1. `require.main === module` guards — these never execute in vitest's
 *    worker environment because vitest always sets `require.main = undefined`.
 *
 * 2. Defensive `if (current === void 0)` guard in `sortByDependencyOrder` —
 *    `queue.shift()` cannot return undefined because the while-loop condition
 *    `queue.length > 0` ensures the queue is non-empty on every iteration.
 *
 * 3. Defensive `if (!dependents)` guard in `sortByDependencyOrder` —
 *    `graph.get(current)` cannot return undefined because every package name
 *    is pre-inserted into `graph` before the BFS loop starts.
 *
 * 4. Defensive `if (currentDegree === void 0)` guard in `sortByDependencyOrder` —
 *    `inDegree.get(dependent)` cannot return undefined because every package name
 *    is pre-inserted into `inDegree` before the BFS loop starts.
 *
 * 5. Catch block body in `hasChanges` — `exec({ ignoreError: true })` swallows
 *    errors internally and never throws, so the surrounding catch is unreachable.
 *
 * 6. Catch block body in `getLastTag` — same reason as above.
 */
function ignoreUnreachableCode(): Plugin {
  return {
    name: "ignore-unreachable-code",
    transform(code: string, id: string) {
      if (!id.endsWith(".ts") || id.includes("node_modules")) {
        return null;
      }

      let patched = code;

      // 1. require.main === module guards
      //    Esbuild preserves `require.main === module` as-is in compiled JS.
      patched = patched.replace(
        /^(if \(require\.main === module\))/m,
        "/* v8 ignore next */\n$1"
      );

      // 2. Defensive `if (current === void 0) { break; }` in sortByDependencyOrder
      //    Esbuild rewrites `=== undefined` to `=== void 0`.
      patched = patched.replace(
        /(\n)([ \t]*if \(current === void 0\) \{)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 3. Defensive `if (!dependents) { continue; }` in sortByDependencyOrder
      patched = patched.replace(
        /(\n)([ \t]*if \(!dependents\) \{)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 4. Defensive `if (currentDegree === void 0) { continue; }` in sortByDependencyOrder
      //    Esbuild rewrites `=== undefined` to `=== void 0`.
      patched = patched.replace(
        /(\n)([ \t]*if \(currentDegree === void 0\) \{)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 5. Catch block body in hasChanges — place ignore before `return true;` inside catch
      patched = patched.replace(
        /([ \t]*\} catch \{\n)([ \t]*return true;\n[ \t]*\}\n\}(?=\nfunction getLastTag))/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 6. Catch block body in getLastTag — place ignore before `return null;` inside catch
      patched = patched.replace(
        /([ \t]*\} catch \{\n)([ \t]*return null;\n[ \t]*\}\n\}(?=\nfunction getLatestNpmPatchVersion))/g,
        "$1/* v8 ignore next */\n$2"
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
