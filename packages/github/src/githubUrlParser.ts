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
