#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unused-vars */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

interface SkillRepo {
  owner: string;
  repo: string;
  fullName: string;
}

interface SkillMetadata {
  name: string;
  description: string;
  path: string;
}

function parseRepoLine(line: string): SkillRepo | null {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  // Parse owner/repo format
  const match = /^([^/]+)\/([^/]+)$/.exec(trimmed);
  if (!match) {
    console.warn(`⚠️  Invalid repo format (expected owner/repo): ${trimmed}`);
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
    fullName: trimmed,
  };
}

function loadReposFromFile(filePath: string): SkillRepo[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  const repos: SkillRepo[] = [];

  for (const line of content.split("\n")) {
    const repo = parseRepoLine(line);
    if (repo) {
      repos.push(repo);
    }
  }

  return repos;
}

function findRepoRoot(): string | null {
  // INIT_CWD is set by npm to the directory where npm install was run
  if (process.env.INIT_CWD !== undefined && process.env.INIT_CWD !== "") {
    return process.env.INIT_CWD;
  }

  // Fallback: walk up from our location past node_modules
  let dir = __dirname;
  while (dir !== "/" && dir !== ".") {
    if (dir.includes("node_modules")) {
      const parts = dir.split("node_modules");
      return parts[0].replace(/\/$/, "");
    }
    const parent = join(dir, "..");
    if (parent === dir) {break;}
    dir = parent;
  }

  return process.cwd();
}

function mergeRepos(packageRepos: SkillRepo[], consumerRepos: SkillRepo[]): SkillRepo[] {
  const seen = new Set<string>();
  const merged: SkillRepo[] = [];

  // Add package repos first
  for (const repo of packageRepos) {
    seen.add(repo.fullName);
    merged.push(repo);
  }

  // Add consumer repos, warn on duplicates but don't fail
  for (const repo of consumerRepos) {
    if (seen.has(repo.fullName)) {
      console.log(`   ℹ️  Already included from package: ${repo.fullName}`);
    } else {
      seen.add(repo.fullName);
      merged.push(repo);
    }
  }

  return merged;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function extractMetadataFromSkill(skillPath: string): SkillMetadata | null {
  if (!existsSync(skillPath)) {
    return null;
  }

  const content = readFileSync(skillPath, "utf-8");

  // Extract YAML frontmatter
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const nameMatch = /^name:\s*(.+)$/m.exec(frontmatter);
  const descMatch = /^description:\s*(.+)$/m.exec(frontmatter);

  if (!nameMatch || !descMatch) {
    return null;
  }

  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
    path: skillPath,
  };
}

function findSkillsInRepo(repoDir: string): SkillMetadata[] {
  const skills: SkillMetadata[] = [];
  const possiblePaths = ["skills", ".", "src/skills"];

  for (const basePath of possiblePaths) {
    const searchDir = join(repoDir, basePath);
    if (!existsSync(searchDir)) {continue;}

    try {
      // Find all SKILL.md files
      const output = execSync(`find "${searchDir}" -name "SKILL.md" -type f`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      if (!output) {continue;}

      const skillFiles = output.split("\n");
      for (const skillFile of skillFiles) {
        const metadata = extractMetadataFromSkill(skillFile);
        if (metadata) {
          // Store relative path from repo root
          const relativePath = skillFile.replace(`${repoDir  }/`, "");
          metadata.path = relativePath;
          skills.push(metadata);
        }
      }
    } catch (error) {
      // Continue if find fails
    }
  }

  return skills;
}

function cloneRepoForMetadata(repo: SkillRepo, tmpDir: string): string {
  const repoDir = join(tmpDir, repo.owner, repo.repo);
  const parentDir = join(tmpDir, repo.owner);

  ensureDir(parentDir);

  if (existsSync(repoDir)) {
    // Update existing clone
    try {
      execSync("git pull", { cwd: repoDir, stdio: "pipe" });
    } catch (error) {
      // Re-clone if pull fails
      rmSync(repoDir, { recursive: true, force: true });
      execSync(
        `git clone --depth 1 https://github.com/${repo.fullName}.git ${repo.repo}`,
        { cwd: parentDir, stdio: "pipe" }
      );
    }
  } else {
    // Fresh clone
    execSync(
      `git clone --depth 1 https://github.com/${repo.fullName}.git ${repo.repo}`,
      { cwd: parentDir, stdio: "pipe" }
    );
  }

  return repoDir;
}

function createReferenceSkill(
  skill: SkillMetadata,
  repo: SkillRepo,
  destDir: string
): void {
  const skillDir = join(destDir, repo.owner, repo.repo, skill.name);
  ensureDir(skillDir);

  const repoUrl = `https://github.com/${repo.fullName}`;
  const skillPath = skill.path;
  const rawUrl = `https://raw.githubusercontent.com/${repo.fullName}/main/${skillPath}`;

  const referenceContent = `---
name: ${skill.name}
description: ${skill.description}
---

# ${skill.name}

**This is a reference skill maintained externally at [${repo.fullName}](${repoUrl})**

To use this skill, fetch and read the full documentation:

\`\`\`bash
curl -s ${rawUrl}
\`\`\`

If the skill references supporting files, fetch those as needed:

\`\`\`bash
curl -s https://raw.githubusercontent.com/${repo.fullName}/main/skills/${skill.name}/path/to/file
\`\`\`

The full skill contains detailed instructions, examples, and reference materials not included in this lightweight reference.
`;

  writeFileSync(join(skillDir, "SKILL.md"), referenceContent);
}

function processRepo(repo: SkillRepo, tmpDir: string, destDir: string): number {
  console.log(`\n📦 Processing ${repo.fullName}...`);

  try {
    // Clone repo to extract metadata
    const repoDir = cloneRepoForMetadata(repo, tmpDir);
    console.log(`   ✅ Cloned`);

    // Find all skills
    const skills = findSkillsInRepo(repoDir);

    if (skills.length === 0) {
      console.log(`   ⚠️  No skills found`);
      return 0;
    }

    console.log(`   Found ${skills.length} skill(s)`);

    // Create reference skills
    for (const skill of skills) {
      createReferenceSkill(skill, repo, destDir);
    }

    console.log(`   ✅ Created ${skills.length} reference skill(s)`);
    return skills.length;
  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    return 0;
  }
}

function generateIndex(repos: SkillRepo[], destDir: string, totalSkills: number): void {
  const lines: string[] = [
    "# External Skills (References)",
    "",
    "Lightweight reference skills that point to externally maintained skills.",
    "",
    `**Total reference skills:** ${totalSkills}`,
    "",
    "## How Reference Skills Work",
    "",
    "These are lightweight skills that contain only metadata (name/description) to trigger when relevant.",
    "When activated, they instruct the agent to clone the external repository and read the full skill.",
    "",
    "This keeps the shared-config package lean while providing access to external skills.",
    "",
    "## Sources",
    "",
  ];

  // Group by owner
  const byOwner = new Map<string, SkillRepo[]>();
  for (const repo of repos) {
    if (!byOwner.has(repo.owner)) {
      byOwner.set(repo.owner, []);
    }
    const ownerRepos = byOwner.get(repo.owner);
    if (ownerRepos) {
      ownerRepos.push(repo);
    }
  }

  for (const [owner, ownerRepos] of byOwner) {
    lines.push(`### ${owner}`);
    lines.push("");
    for (const repo of ownerRepos) {
      lines.push(`- **[${repo.repo}](https://github.com/${repo.fullName})**`);
    }
    lines.push("");
  }

  lines.push("## Managing External Skills");
  lines.push("");
  lines.push("### Package Default Skills");
  lines.push("");
  lines.push("Default skills are listed in the package's `external-skills.txt`.");
  lines.push("");
  lines.push("### Adding Project-Specific Skills");
  lines.push("");
  lines.push("Create `external-skills.txt` in your project root:");
  lines.push("");
  lines.push("```");
  lines.push("# Your custom skill repos");
  lines.push("your-org/agent-skills");
  lines.push("```");
  lines.push("");
  lines.push("### Updating");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run sync-external-skills");
  lines.push("```");
  lines.push("");

  writeFileSync(join(destDir, "README.md"), lines.join("\n"));
  console.log("\n📝 Generated README.md");
}

function main(): void {
  console.log("🔄 Syncing external skills (reference mode)...\n");

  const packageRoot = join(__dirname, "..");
  const monorepoRoot = join(packageRoot, "../..");
  const repoRoot = findRepoRoot();

  // Load repos from package's external-skills.txt
  const packageReposFile = join(packageRoot, "external-skills.txt");
  const packageRepos = loadReposFromFile(packageReposFile);
  console.log(`📋 Package default repos: ${packageRepos.length}`);

  // Load repos from consuming repo's external-skills.txt (if it exists)
  let consumerRepos: SkillRepo[] = [];
  if (repoRoot !== null && repoRoot !== packageRoot) {
    const consumerReposFile = join(repoRoot, "external-skills.txt");
    consumerRepos = loadReposFromFile(consumerReposFile);
    if (consumerRepos.length > 0) {
      console.log(`📋 Project-specific repos: ${consumerRepos.length}`);
    }
  }

  // Merge repos (package + consumer)
  const allRepos = mergeRepos(packageRepos, consumerRepos);

  if (allRepos.length === 0) {
    console.log("ℹ️  No external skills configured");
    return;
  }

  console.log(`📋 Total repos to sync: ${allRepos.length}`);

  const tmpDir = join(packageRoot, ".tmp", "skills");
  // Generate into monorepo root so skills work for the monorepo itself
  const destDir = join(monorepoRoot, ".claude", "skills", "external");

  // Clean destination directory
  if (existsSync(destDir)) {
    rmSync(destDir, { recursive: true, force: true });
  }

  // Ensure directories exist
  ensureDir(tmpDir);
  ensureDir(destDir);

  // Process each repo
  let totalSkills = 0;
  for (const repo of allRepos) {
    totalSkills += processRepo(repo, tmpDir, destDir);
  }

  // Generate index
  generateIndex(allRepos, destDir, totalSkills);

  console.log("\n✅ External skills sync complete!");
  console.log(`\nTotal reference skills: ${totalSkills}`);
  console.log(`Skills available in: .claude/skills/external/\n`);
  console.log("💡 Tip: Commit these to the monorepo so they work for all packages\n");
}

main();
