/**
 * Summarize service for generating file and directory summaries.
 * Each summary is produced by a single self-contained AI call.
 *
 * Templates are injected at construction time (no file-system coupling).
 */

/** Minimal AI client interface — satisfied by @hardlydifficult/ai's `AI`. */
export interface SummarizeAI {
  chat(prompt: string): { text(): PromiseLike<string> };
}

/** Prompt templates the service needs. Loaded by the caller. */
export interface SummarizeTemplates {
  fileSummary: string;
  dirSummary: string;
}

/** Function to fill template placeholders. */
export type TemplateFiller = (
  template: string,
  vars: Record<string, string>
) => string;

/** Function to add line numbers to source code. */
export type LineNumberFormatter = (content: string) => string;

/** Function to heal/fix YAML output from AI. */
export type YamlHealer = (yaml: string) => string;

/** Maximum file size to summarize (500KB). */
const MAX_FILE_SIZE = 500 * 1024;

/** Minimum file size worth summarizing. */
const MIN_FILE_SIZE = 50;

/** Extensions to summarize. */
const SUMMARIZABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".pyx",
  ".java",
  ".kt",
  ".kts",
  ".go",
  ".rs",
  ".cs",
  ".cpp",
  ".cc",
  ".cxx",
  ".c",
  ".h",
  ".hpp",
  ".rb",
  ".php",
  ".swift",
  ".scala",
  ".lua",
  ".sh",
  ".bash",
  ".zsh",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".md",
]);

/** Files to always skip regardless of extension. */
const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
]);

export interface SummarizeServiceConfig {
  ai: SummarizeAI;
  templates: SummarizeTemplates;
  fillTemplate: TemplateFiller;
  formatWithLineNumbers: LineNumberFormatter;
  healYaml: YamlHealer;
}

/**
 * Service for generating file and directory summaries via AI.
 */
export class SummarizeService {
  private readonly ai: SummarizeAI;
  private readonly templates: SummarizeTemplates;
  private readonly fillTemplate: TemplateFiller;
  private readonly formatWithLineNumbers: LineNumberFormatter;
  private readonly healYaml: YamlHealer;

  constructor(config: SummarizeServiceConfig) {
    this.ai = config.ai;
    this.templates = config.templates;
    this.fillTemplate = config.fillTemplate;
    this.formatWithLineNumbers = config.formatWithLineNumbers;
    this.healYaml = config.healYaml;
  }

  /** Check if a file path should be summarized. */
  shouldSummarize(filePath: string, fileSize?: number): boolean {
    const fileName = filePath.split("/").pop() ?? "";
    if (SKIP_FILES.has(fileName)) {
      return false;
    }

    if (fileSize !== undefined) {
      if (fileSize > MAX_FILE_SIZE || fileSize < MIN_FILE_SIZE) {
        return false;
      }
    }

    const ext = `.${fileName.split(".").pop()?.toLowerCase() ?? ""}`;
    return SUMMARIZABLE_EXTENSIONS.has(ext);
  }

  /** Generate a summary for a single file. Returns raw YAML string. */
  async summarizeFile(
    filePath: string,
    fileContent: string,
    repoName: string
  ): Promise<string> {
    const numberedContent = this.formatWithLineNumbers(fileContent);
    const prompt = this.fillTemplate(this.templates.fileSummary, {
      filePath,
      repoName,
      fileContent: numberedContent,
    });

    const response = await this.ai.chat(prompt).text();
    return this.healYaml(response);
  }

  /**
   * Generate a summary for a directory.
   * directoryTree is a pre-formatted tree string with annotations and details.
   * Returns plain text description.
   */
  async summarizeDirectory(
    dirPath: string,
    directoryTree: string,
    repoName: string
  ): Promise<string> {
    const prompt = this.fillTemplate(this.templates.dirSummary, {
      dirPath: dirPath || "(root)",
      repoName,
      directoryTree,
    });

    const response = await this.ai.chat(prompt).text();
    return response.trim();
  }
}
