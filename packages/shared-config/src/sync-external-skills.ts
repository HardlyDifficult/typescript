#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

interface SkillSource {
  name: string;
  repo: string;
  path: string;
  description: string;
}

interface ExternalSkillsConfig {
  sources: SkillSource[];
}

function loadConfig(): ExternalSkillsConfig {
  const configPath = join(__dirname, "..", "external-skills.json");
  const configContent = readFileSync(configPath, "utf-8");
  return JSON.parse(configContent);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function cloneOrUpdateRepo(source: SkillSource, tmpDir: string): string {
  const repoDir = join(tmpDir, source.name);

  console.log(`\n📦 Fetching ${source.name} from ${source.repo}...`);

  if (existsSync(repoDir)) {
    // Update existing clone
    console.log(`   Updating existing clone...`);
    execSync("git pull", { cwd: repoDir, stdio: "inherit" });
  } else {
    // Fresh clone
    console.log(`   Cloning repository...`);
    execSync(
      `git clone --depth 1 https://github.com/${source.repo}.git ${source.name}`,
      { cwd: tmpDir, stdio: "inherit" }
    );
  }

  return join(repoDir, source.path);
}

function copySkills(sourceDir: string, destDir: string, sourceName: string): void {
  if (!existsSync(sourceDir)) {
    console.warn(`   ⚠️  Warning: Skills directory not found at ${sourceDir}`);
    return;
  }

  // Remove old skills for this source
  const sourceDestDir = join(destDir, sourceName);
  if (existsSync(sourceDestDir)) {
    rmSync(sourceDestDir, { recursive: true, force: true });
  }

  // Copy new skills
  execSync(`cp -R "${sourceDir}" "${sourceDestDir}"`, { stdio: "inherit" });
  console.log(`   ✅ Copied skills to ${sourceName}/`);
}

function generateIndex(config: ExternalSkillsConfig, destDir: string): void {
  const lines: string[] = [
    "# External Skills",
    "",
    "Skills from external repositories, automatically synced.",
    "",
    "## Sources",
    "",
  ];

  for (const source of config.sources) {
    lines.push(`### ${source.name}`);
    lines.push("");
    lines.push(`- **Repository**: [${source.repo}](https://github.com/${source.repo})`);
    lines.push(`- **Description**: ${source.description}`);
    lines.push("");
  }

  lines.push("## Updating");
  lines.push("");
  lines.push("To sync with the latest versions from upstream:");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run sync-external-skills");
  lines.push("```");
  lines.push("");
  lines.push("This fetches the latest skills from each source repository and updates the local copies.");
  lines.push("");

  writeFileSync(join(destDir, "README.md"), lines.join("\n"));
  console.log("\n📝 Generated README.md");
}

function main(): void {
  console.log("🔄 Syncing external skills...\n");

  const config = loadConfig();
  const rootDir = join(__dirname, "..");
  const tmpDir = join(rootDir, ".tmp-skills");
  const destDir = join(rootDir, "files", ".claude", "skills", "external");

  // Ensure directories exist
  ensureDir(tmpDir);
  ensureDir(destDir);

  // Fetch and copy each source
  for (const source of config.sources) {
    try {
      const skillsDir = cloneOrUpdateRepo(source, tmpDir);
      copySkills(skillsDir, destDir, source.name);
    } catch (error) {
      console.error(`   ❌ Error processing ${source.name}:`, error);
    }
  }

  // Generate index
  generateIndex(config, destDir);

  console.log("\n✅ External skills sync complete!");
  console.log(`\nSkills available in: files/.claude/skills/external/\n`);
}

main();
