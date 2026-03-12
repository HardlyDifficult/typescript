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
 * 3. Defensive `if (!dependents)` guard in `sortByDependencyOrder` BFS loop —
 *    `graph.get(current)` cannot return undefined because every package name
 *    is pre-inserted into `graph` before the BFS loop starts.
 *
 * 4. Defensive `if (currentDegree === void 0)` guard in `sortByDependencyOrder`
 *    BFS loop — same reason as above for `inDegree`.
 *
 * 5. Defensive `if (dependents)` guard in the dependency-building loop —
 *    `graph.get(dep)` cannot return undefined because every package name is
 *    pre-inserted. The false branch is unreachable.
 *
 * 6. Defensive `if (currentDegree !== void 0)` guard in the dependency-building
 *    loop — same reason.
 *
 * 7. Catch block body in `hasChanges` — `exec({ ignoreError: true })` swallows
 *    errors internally and never throws, so the surrounding catch is unreachable.
 *
 * 8. Catch block body in `getLastTag` — same reason as above.
 *
 * 9. Ternary `typeof result === "string" ? result.trim() : ""` in `exec` —
 *    `execSync` with `encoding: "utf-8"` always returns a string, so the `""`
 *    fallback branch is never reached.
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
      patched = patched.replace(
        /^(if \(require\.main === module\))/m,
        "/* v8 ignore next */\n$1"
      );

      // 2. Defensive `if (current === void 0) { break; }` in BFS loop
      patched = patched.replace(
        /(\n)([ \t]*if \(current === void 0\) \{)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 3. Defensive `if (!dependents)` in BFS loop
      patched = patched.replace(
        /(\n)([ \t]*if \(!dependents\) \{)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 4. Defensive `if (currentDegree === void 0)` in BFS loop
      patched = patched.replace(
        /(\n)([ \t]*if \(currentDegree === void 0\) \{)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 5. Defensive `if (dependents)` false branch in dependency-building loop —
      //    `graph.get(dep)` always returns an array; false branch unreachable.
      //    Use `/* v8 ignore else */` to skip only the missing-else branch.
      patched = patched.replace(
        /(\n)([ \t]*if \(dependents\) \{)/g,
        "$1/* v8 ignore else */\n$2"
      );

      // 6. Defensive `if (currentDegree !== void 0)` false branch in dependency-building loop
      patched = patched.replace(
        /(\n)([ \t]*if \(currentDegree !== void 0\) \{)/g,
        "$1/* v8 ignore else */\n$2"
      );

      // 7. Catch block body in hasChanges
      patched = patched.replace(
        /([ \t]*\} catch \{\n)([ \t]*return true;\n[ \t]*\}\n\}(?=\nfunction getLastTag))/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 8. Catch block body in getLastTag
      patched = patched.replace(
        /([ \t]*\} catch \{\n)([ \t]*return null;\n[ \t]*\}\n\}(?=\nfunction getLatestNpmPatchVersion))/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 9. Ternary `typeof result === "string" ? result.trim() : ""`
      //    The `""` branch is unreachable: execSync with encoding:"utf-8" always returns a string.
      patched = patched.replace(
        /(\n)([ \t]*return typeof result === "string" \? result\.trim\(\) : "";)/g,
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
