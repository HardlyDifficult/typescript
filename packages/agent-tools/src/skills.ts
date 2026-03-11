/**
 * Utility for loading skill markdown files from a categorized directory.
 *
 * Skills are organized into category subdirectories:
 *   skills/github/git-workflows.md
 *   skills/coding/typescript-strict.md
 *
 * Each skill is a markdown file. The first non-heading, non-empty line
 * is used as the short description.
 *
 * Supports two layouts per category:
 *   - skills/category/skill-name.md         (flat file)
 *   - skills/category/skill-name/SKILL.md   (subdirectory with SKILL.md)
 */

import fs from "fs";
import path from "path";

export interface Skill {
  /** e.g. "git-workflows" */
  name: string;
  /** e.g. "github" */
  category: string;
  /** First non-empty, non-heading line from the markdown (up to 200 chars) */
  description: string;
  /** Full markdown content */
  content: string;
}

/**
 * Load all skills from a given category directory under skillsDir.
 */
export function loadSkillsFromCategory(
  skillsDir: string,
  category: string
): Skill[] {
  const categoryDir = path.join(skillsDir, category);
  if (!fs.existsSync(categoryDir)) {
    return [];
  }

  const skills: Skill[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(categoryDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    let content = "";
    let name = "";

    if (entry.isFile() && entry.name.endsWith(".md")) {
      name = entry.name.replace(/\.md$/, "");
      content = fs.readFileSync(path.join(categoryDir, entry.name), "utf-8");
    } else if (entry.isDirectory()) {
      const skillFile = path.join(categoryDir, entry.name, "SKILL.md");
      if (fs.existsSync(skillFile)) {
        ({ name } = entry);
        content = fs.readFileSync(skillFile, "utf-8");
      }
    }

    if (name && content) {
      const description = extractDescription(content);
      skills.push({ name, category, description, content });
    }
  }

  return skills;
}

/**
 * Load all skills from the given categories.
 */
export function loadAllSkills(
  skillsDir: string,
  categories: string[]
): Skill[] {
  return categories.flatMap((cat) => loadSkillsFromCategory(skillsDir, cat));
}

/**
 * Extract a short description from a markdown skill file.
 * Skips frontmatter (---), headings (#), and blank lines.
 * Returns the first meaningful line of prose (up to 200 chars).
 */
function extractDescription(markdown: string): string {
  const lines = markdown.split("\n");
  let inFrontmatter = false;
  let frontmatterCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "---") {
      frontmatterCount += 1;
      if (frontmatterCount === 1) {
        inFrontmatter = true;
        continue;
      } else if (frontmatterCount === 2) {
        inFrontmatter = false;
        continue;
      }
    }

    if (inFrontmatter) {
      continue;
    }

    if (frontmatterCount === 0 && trimmed.startsWith("description:")) {
      const val = trimmed
        .replace(/^description:\s*["']?/, "")
        .replace(/["']$/, "");
      if (val) {
        return val.slice(0, 200);
      }
    }

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    return trimmed.slice(0, 200);
  }

  return "";
}
