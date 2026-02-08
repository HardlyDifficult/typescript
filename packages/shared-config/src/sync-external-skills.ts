#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

interface SkillRepo {
  owner: string;
  repo: string;
  fullName: string;
}

function parseRepoLine(line: string): SkillRepo | null {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  // Parse owner/repo format
  const match = trimmed.match(/^([^\/]+)\/([^\/]+)$/);
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
    if (parent === dir) break;
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

function cloneOrUpdateRepo(repo: SkillRepo, tmpDir: string): string {
  const repoDir = join(tmpDir, repo.owner, repo.repo);
  const parentDir = join(tmpDir, repo.owner);

  console.log(`\n📦 Fetching ${repo.fullName}...`);

  ensureDir(parentDir);

  if (existsSync(repoDir)) {
    // Update existing clone
    console.log(`   Updating existing clone...`);
    try {
      execSync("git pull", { cwd: repoDir, stdio: "pipe" });
      console.log(`   ✅ Updated`);
    } catch (error) {
      console.warn(`   ⚠️  Update failed, will re-clone`);
      rmSync(repoDir, { recursive: true, force: true });
      return cloneOrUpdateRepo(repo, tmpDir);
    }
  } else {
    // Fresh clone
    console.log(`   Cloning repository...`);
    try {
      execSync(
        `git clone --depth 1 https://github.com/${repo.fullName}.git ${repo.repo}`,
        { cwd: parentDir, stdio: "pipe" }
      );
      console.log(`   ✅ Cloned`);
    } catch (error) {
      console.error(`   ❌ Failed to clone ${repo.fullName}`);
      throw error;
    }
  }

  // Look for skills directory (try common locations)
  const possiblePaths = ["skills", ".", "src/skills"];
  for (const path of possiblePaths) {
    const skillsDir = join(repoDir, path);
    if (existsSync(skillsDir)) {
      const hasSkills = existsSync(join(skillsDir, "SKILL.md")) ||
        execSync(`find "${skillsDir}" -name "SKILL.md" -type f | head -1`, { encoding: "utf-8" }).trim();
      if (hasSkills) {
        return skillsDir;
      }
    }
  }

  return join(repoDir, "skills"); // Default fallback
}

function copySkills(sourceDir: string, destDir: string, repo: SkillRepo): void {
  if (!existsSync(sourceDir)) {
    console.warn(`   ⚠️  Skills directory not found at ${sourceDir}`);
    return;
  }

  // Create destination with owner/repo structure
  const repoDestDir = join(destDir, repo.owner, repo.repo);

  // Remove old skills for this repo
  if (existsSync(repoDestDir)) {
    rmSync(repoDestDir, { recursive: true, force: true });
  }

  // Ensure parent directory exists
  ensureDir(join(destDir, repo.owner));

  // Copy new skills
  try {
    execSync(`cp -R "${sourceDir}" "${repoDestDir}"`, { stdio: "pipe" });
    const skillCount = execSync(`find "${repoDestDir}" -name "SKILL.md" | wc -l`, { encoding: "utf-8" }).trim();
    console.log(`   ✅ Copied ${skillCount} skill(s) to ${repo.owner}/${repo.repo}/`);
  } catch (error) {
    console.error(`   ❌ Failed to copy skills for ${repo.fullName}`);
  }
}

function generateIndex(repos: SkillRepo[], destDir: string): void {
  const lines: string[] = [
    "# External Skills",
    "",
    "Skills from external repositories, automatically synced.",
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
    byOwner.get(repo.owner)!.push(repo);
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
  lines.push("another-org/claude-skills");
  lines.push("```");
  lines.push("");
  lines.push("These will be synced alongside the package's default skills.");
  lines.push("");
  lines.push("### Updating");
  lines.push("");
  lines.push("To sync with the latest versions:");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run sync-external-skills");
  lines.push("```");
  lines.push("");

  writeFileSync(join(destDir, "README.md"), lines.join("\n"));
  console.log("\n📝 Generated README.md");
}

function main(): void {
  console.log("🔄 Syncing external skills...\n");

  const packageRoot = join(__dirname, "..");
  const repoRoot = findRepoRoot();

  // Load repos from package's external-skills.txt
  const packageReposFile = join(packageRoot, "external-skills.txt");
  const packageRepos = loadReposFromFile(packageReposFile);
  console.log(`📋 Package default repos: ${packageRepos.length}`);

  // Load repos from consuming repo's external-skills.txt (if it exists)
  let consumerRepos: SkillRepo[] = [];
  if (repoRoot && repoRoot !== packageRoot) {
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

  const tmpDir = join(packageRoot, ".tmp-skills");
  const destDir = join(packageRoot, "files", ".claude", "skills", "external");

  // Ensure directories exist
  ensureDir(tmpDir);
  ensureDir(destDir);

  // Fetch and copy each repo
  for (const repo of allRepos) {
    try {
      const skillsDir = cloneOrUpdateRepo(repo, tmpDir);
      copySkills(skillsDir, destDir, repo);
    } catch (error) {
      console.error(`   ❌ Error processing ${repo.fullName}:`, error instanceof Error ? error.message : error);
    }
  }

  // Generate index
  generateIndex(allRepos, destDir);

  // Count total skills
  const totalSkills = execSync(
    `find "${destDir}" -name "SKILL.md" | wc -l`,
    { encoding: "utf-8" }
  ).trim();

  console.log("\n✅ External skills sync complete!");
  console.log(`\nTotal external skills: ${totalSkills}`);
  console.log(`Skills available in: files/.claude/skills/external/\n`);
}

main();
