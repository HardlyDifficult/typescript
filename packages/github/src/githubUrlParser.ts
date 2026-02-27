/**
 * GitHub URL parsing utilities for extracting file and directory information.
 */

export interface GitHubFileInfo {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}

export interface GitHubDirectoryInfo {
  owner: string;
  repo: string;
  branch: string;
  dirPath: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

/**
 * Parse a GitHub repo reference from one of these formats:
 * - owner/repo
 * - github.com/owner/repo
 * - https://github.com/owner/repo(.git)
 * - https://github.com/owner/repo/pull/123
 */
export function parseGitHubRepoReference(value: string): GitHubRepoInfo | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const direct = /^([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  if (direct) {
    return { owner: direct[1], repo: direct[2] };
  }

  let normalized: string | null;
  if (trimmed.startsWith("github.com/")) {
    normalized = `https://${trimmed}`;
  } else if (/^https?:\/\//.test(trimmed)) {
    normalized = trimmed;
  } else {
    normalized = null;
  }
  if (normalized === null) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname !== "github.com") {
      return null;
    }

    const [owner, rawRepo] = url.pathname
      .split("/")
      .filter((segment) => segment !== "")
      .slice(0, 2);
    if (!owner || !rawRepo) {
      return null;
    }

    const repo = rawRepo.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;
    return repo === "" ? null : { owner, repo };
  } catch {
    return null;
  }
}

/**
 * Parse a GitHub file URL.
 * Format: https://github.com/owner/repo/blob/branch/path/to/file.ts
 *
 * @param url - The GitHub file URL
 * @returns Parsed file info or null if invalid
 */
export function parseGitHubFileUrl(url: string): GitHubFileInfo | null {
  // Match: github.com/owner/repo/blob/branch/path/to/file
  const match = /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/.exec(url);
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
    branch: match[3],
    filePath: match[4],
  };
}

/**
 * Parse a GitHub directory URL.
 * Format: https://github.com/owner/repo/tree/branch/path/to/directory
 *
 * @param url - The GitHub directory URL
 * @returns Parsed directory info or null if invalid
 */
export function parseGitHubDirectoryUrl(
  url: string
): GitHubDirectoryInfo | null {
  // Match: github.com/owner/repo/tree/branch/path/to/dir
  const match = /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/.exec(url);
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
    branch: match[3],
    dirPath: match[4],
  };
}
