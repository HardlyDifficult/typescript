/** Abstraction for file system operations used by agent tools. */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  searchFiles(pattern: string): Promise<string[]>;
}

/** Optional metadata provider for directory/file annotations. */
export interface AnnotationProvider {
  getDirPurpose(dirPath: string): Promise<string | null>;
  getChildAnnotations(dirPath: string): Promise<ReadonlyMap<string, string>>;
  getChildDetails(
    dirPath: string
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
