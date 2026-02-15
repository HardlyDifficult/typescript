#!/usr/bin/env node

/**
 * Generates llms.txt and llms-full.txt in the apps/docs/dist/ directory.
 *
 * llms.txt: Compact index of all library packages with descriptions and links.
 * llms-full.txt: Complete API reference with type signatures and README content
 *   for AI agents to quickly understand the full API surface.
 *
 * Usage:
 *   npx generate-llms-txt
 *
 * Requires: packages must be built first (needs dist/*.d.ts files).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const LIBRARY_PACKAGES = [
  "ai-msg",
  "chat",
  "date-time",
  "document-generator",
  "github",
  "logger",
  "poller",
  "state-tracker",
  "task-list",
  "text",
  "throttle",
  "usage-tracker",
  "workflow-engine",
];

const DOCS_BASE_URL = "https://hardlydifficult.github.io/typescript";

interface PackageInfo {
  name: string;
  dirName: string;
  description: string;
  declarations: string;
  readme: string;
}

function readPackageDescription(pkgDir: string): string {
  const pkgJsonPath = join(pkgDir, "package.json");
  const content = readFileSync(pkgJsonPath, "utf-8");
  const pkg = JSON.parse(content) as { description?: string };
  if (pkg.description !== undefined && pkg.description !== "") {
    return pkg.description;
  }

  // Fall back to first content line of README (after the heading)
  const readmePath = join(pkgDir, "README.md");
  if (!existsSync(readmePath)) {
    return "";
  }
  const readme = readFileSync(readmePath, "utf-8");
  const lines = readme.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed !== "" && !trimmed.startsWith("#")) {
      return trimmed;
    }
  }
  return "";
}

function readReadme(pkgDir: string): string {
  const readmePath = join(pkgDir, "README.md");
  if (!existsSync(readmePath)) {
    return "";
  }
  return readFileSync(readmePath, "utf-8").trim();
}

function collectDeclarations(pkgDir: string): string {
  const distDir = join(pkgDir, "dist");
  if (!existsSync(distDir)) {
    return "// No declarations found (package not built)";
  }

  const indexDtsPath = join(distDir, "index.d.ts");
  if (!existsSync(indexDtsPath)) {
    return "// No index.d.ts found";
  }

  const indexContent = readFileSync(indexDtsPath, "utf-8");

  // Extract re-exported module paths from the barrel file
  const reExportPattern = /from\s+"(\.\/[^"]+)"/g;
  const modulePaths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = reExportPattern.exec(indexContent)) !== null) {
    const modulePath = match[1];
    if (modulePath !== undefined) {
      modulePaths.push(modulePath);
    }
  }

  if (modulePaths.length === 0) {
    // Declarations are inline in index.d.ts (not re-exported)
    return stripSourceMapComments(indexContent);
  }

  // Read each re-exported .d.ts file
  const declarations: string[] = [];
  for (const modulePath of modulePaths) {
    const dtsPath = join(distDir, `${modulePath.replace(/\.js$/, "")}.d.ts`);
    if (!existsSync(dtsPath)) {
      continue;
    }
    const content = readFileSync(dtsPath, "utf-8");
    const cleaned = stripPrivateMembers(stripSourceMapComments(content));
    if (cleaned.trim()) {
      declarations.push(cleaned.trim());
    }
  }

  return declarations.join("\n\n");
}

function stripSourceMapComments(content: string): string {
  return content.replace(/\/\/# sourceMappingURL=.*$/gm, "").trim();
}

function stripPrivateMembers(content: string): string {
  // Remove private/protected member declarations from .d.ts output
  return content
    .replace(/^\s+private\s+.*$/gm, "")
    .replace(/^\s+protected\s+.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

function collectPackageInfo(rootDir: string): PackageInfo[] {
  const packages: PackageInfo[] = [];

  for (const dirName of LIBRARY_PACKAGES) {
    const pkgDir = join(rootDir, "packages", dirName);
    if (!existsSync(pkgDir)) {
      continue;
    }

    packages.push({
      name: `@hardlydifficult/${dirName}`,
      dirName,
      description: readPackageDescription(pkgDir),
      declarations: collectDeclarations(pkgDir),
      readme: readReadme(pkgDir),
    });
  }

  return packages;
}

function generateLlmsTxt(packages: PackageInfo[]): string {
  const packageList = packages
    .map(
      (pkg) =>
        `- [${pkg.name}](${DOCS_BASE_URL}/${pkg.dirName}/): ${pkg.description}`
    )
    .join("\n");

  return `# @hardlydifficult TypeScript Libraries

> Monorepo of opinionated TypeScript libraries. One right way to do each thing — no flexible alternatives.

## Packages

${packageList}

## Documentation

- [Full API Reference](${DOCS_BASE_URL}/llms-full.txt): Complete API surface with type signatures and README content for all packages
- [API Docs Site](${DOCS_BASE_URL}/): Browsable, searchable API documentation

## Source

- [GitHub](https://github.com/HardlyDifficult/typescript)
`;
}

function generateLlmsFullTxt(packages: PackageInfo[]): string {
  const sections = packages.map((pkg) => {
    const parts = [`## ${pkg.name}\n`];

    if (pkg.description !== "") {
      parts.push(`${pkg.description}\n`);
    }

    parts.push("### API\n");
    parts.push("```typescript");
    parts.push(pkg.declarations);
    parts.push("```\n");

    if (pkg.readme !== "") {
      parts.push("### Documentation\n");
      parts.push(pkg.readme);
    }

    return parts.join("\n");
  });

  return `# @hardlydifficult TypeScript Libraries — Full API Reference

> Monorepo of opinionated TypeScript libraries. One right way to do each thing — no flexible alternatives.
> This file contains the complete API surface for all packages, optimized for AI agent consumption.

${sections.join("\n\n---\n\n")}
`;
}

function main(): void {
  const rootDir = process.cwd();
  const docsDir = join(rootDir, "apps", "docs", "dist");

  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  const packages = collectPackageInfo(rootDir);

  const llmsTxt = generateLlmsTxt(packages);
  writeFileSync(join(docsDir, "llms.txt"), llmsTxt, "utf-8");

  const llmsFullTxt = generateLlmsFullTxt(packages);
  writeFileSync(join(docsDir, "llms-full.txt"), llmsFullTxt, "utf-8");

  // Also write to root for direct access (standard location for llms.txt)
  writeFileSync(join(rootDir, "llms.txt"), llmsTxt, "utf-8");

  // eslint-disable-next-line no-console
  console.log(
    `Generated llms.txt and llms-full.txt for ${String(packages.length)} packages.`
  );
}

main();
