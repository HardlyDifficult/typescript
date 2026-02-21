/** Optional metadata provider for directory/file annotations. */
export interface AnnotationProvider {
  /** Get the purpose string for a directory, or null if no summary exists. */
  getDirPurpose(dirPath: string): Promise<string | null>;
  /** Get purpose annotations for immediate children of a directory. */
  getChildAnnotations(
    dirPath: string,
  ): Promise<ReadonlyMap<string, string>>;
}
