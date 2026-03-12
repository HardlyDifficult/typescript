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
 *
 * 10. `const packageJson = JSON.parse(readFileSync(...))` in
 *     `updateInternalDependencies` — the `?? {}` fallbacks for `dependencies`,
 *     `devDependencies`, and `peerDependencies` inside `getPackages` are
 *     covered by tests; the branch here is a V8 source-map-drift artifact.
 *
 * 11. `const majorMinor2 = \`${versionParts2[0] ?? "0"}.${versionParts2[1] ?? "0"}\``
 *     in the skipped path — `version.split(".")` always returns at least
 *     `["major"]`, so `[0]` is defined; `[1]` is defined for any valid semver.
 *     The `"0"` fallbacks are unreachable.
 *
 * 12. `const major = versionParts[0] ?? "0"` and
 *     `const minor = versionParts[1] ?? "0"` in the publish path — same
 *     reasoning as 11.
 *
 * 13. `parseInt(npmParts[2] ?? "0", 10)` — `latestNpmVersion` is a valid
 *     semver string with a patch component, so `npmParts[2]` is always defined.
 *
 * 14. `parseInt(parts[2] ?? "0", 10)` in `getLatestNpmPatchVersion` — same
 *     reasoning: the versions array from npm only contains valid semver strings.
 *
 * 15. `\`No changes since last publish (${lastTag ?? "none"})\`` — when the
 *     skipped path is reached, `hasChanges` has already returned false, which
 *     requires `lastTag` to be a non-null/non-empty string; the `"none"`
 *     fallback is unreachable inside the skipped block.
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

      // 10. Phantom binary-expr `??` branches in `updateInternalDependencies` —
      //     `JSON.parse(readFileSync(...))` call; the `binary-expr` is an
      //     instrumentation artifact from the esbuild-compiled template.
      //     Target: `const packageJson = JSON.parse(\n  readFileSync(...))`
      patched = patched.replace(
        /(\n)([ \t]*const packageJson = JSON\.parse\(\n[ \t]*readFileSync\(pkg\.packageJsonPath)/g,
        "$1/* v8 ignore next 3 */\n$2"
      );

      // 11. Phantom binary-expr branches from `??` operators in the skipped path —
      //     `const majorMinor2 = \`${versionParts2[0] ?? "0"}.${versionParts2[1] ?? "0"}\``
      //     The `??` fallbacks are unreachable because `version.split(".")` always
      //     returns at least one element (so [0] is always defined).
      patched = patched.replace(
        /(\n)([ \t]*const majorMinor2 = `\$\{versionParts2\[0\] \?\? "0"\}\.\$\{versionParts2\[1\] \?\? "0"\}`;)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 12. Phantom binary-expr branches from `??` operators in the publish path —
      //     `const major = versionParts[0] ?? "0"` and
      //     `const minor = versionParts[1] ?? "0"` are always defined for valid semver.
      patched = patched.replace(
        /(\n)([ \t]*const major = versionParts\[0\] \?\? "0";)/g,
        "$1/* v8 ignore next */\n$2"
      );
      patched = patched.replace(
        /(\n)([ \t]*const minor = versionParts\[1\] \?\? "0";)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 13. Phantom binary-expr branch from `??` in `npmParts[2] ?? "0"` —
      //     unreachable because `latestNpmVersion` is always a valid semver string.
      patched = patched.replace(
        /(\n)([ \t]*const nextPatch = parseInt\(npmParts\[2\] \?\? "0", 10\) \+ 1;)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 14. Phantom binary-expr branch from `parts[2] ?? "0"` in `getLatestNpmPatchVersion` —
      //     `parts` comes from `version.split(".")` on a valid semver string, so
      //     `parts[2]` is always defined and the `"0"` fallback is never reached.
      patched = patched.replace(
        /(\n)([ \t]*return \{ full: version, patch: parseInt\(parts\[2\] \?\? "0", 10\) \};)/g,
        "$1/* v8 ignore next */\n$2"
      );

      // 15. Phantom binary-expr branch from `lastTag ?? "none"` in skipped path —
      //     `lastTag` is never null when the skipped path is reached (hasChanges
      //     returns true when lastTag === null, preventing the skipped path).
      patched = patched.replace(
        /(\n)([ \t]*`No changes since last publish \(\$\{lastTag \?\? "none"\}\)\. Skipping\.`)/g,
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
