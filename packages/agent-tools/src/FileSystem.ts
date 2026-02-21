/** Abstraction for file system operations used by coding agent tools. */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  searchFiles(pattern: string): Promise<string[]>;
}
