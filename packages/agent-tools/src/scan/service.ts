/**
 * Scan service for analyzing repositories for specific topics.
 * Walks through files, sends them to AI for analysis, and aggregates results.
 *
 * Templates are injected at construction time so the service has no
 * file-system coupling — callers decide where prompts live.
 */

import path from "node:path";

import { glob } from "tinyglobby";

import {
  type AggregationDeps,
  createOverallSummary,
  createRepoSummary,
} from "./aggregation.js";
import type {
  RepoScanSummary,
  ScanFinding,
  ScanInput,
  ScanOutput,
  ScanProgressInfo,
} from "./types.js";

/** Minimal AI client interface — satisfied by @hardlydifficult/ai's `AI`. */
export interface ScanAI {
  chat(prompt: string): { text(): PromiseLike<string> };
}

/** Minimal repo manager interface — satisfied by RepoManager. */
export interface ScanRepoManager {
  ensureRepo(opts: {
    cloneUrl: string;
    branch: string;
    owner: string;
    name: string;
    useDefaultBranch: boolean;
  }): Promise<string>;
  readFile(repoPath: string, filePath: string): Promise<string>;
}

/** Prompt templates that the service needs. Loaded by the caller. */
export interface ScanTemplates {
  fileAnalysis: string;
  repoSummary: string;
  overallSummary: string;
}

/** Function to fill template placeholders (e.g. replaceTemplate from @hardlydifficult/text). */
export type TemplateFiller = (
  template: string,
  vars: Record<string, string>
) => string;

/** Typed extraction function — parses JSON from AI responses. */
export type ExtractTypedFn = <T>(
  text: string,
  schema: { parse(v: unknown): T },
  sentinel?: string
) => T[];

/** Maximum file size to analyze (500KB). */
const MAX_FILE_SIZE = 500 * 1024;

/** Extensions to analyze by default. */
const CODE_EXTENSIONS = new Set([
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
]);

export interface ScanServiceConfig {
  repoManager: ScanRepoManager;
  ai: ScanAI;
  templates: ScanTemplates;
  fillTemplate: TemplateFiller;
  extractTyped: ExtractTypedFn;
}

export type ProgressCallback = (progress: ScanProgressInfo) => void;

/**
 * Service for scanning repositories for specific topics.
 */
export class ScanService {
  private readonly repoManager: ScanRepoManager;
  private readonly ai: ScanAI;
  private readonly templates: ScanTemplates;
  private readonly fillTemplate: TemplateFiller;
  private readonly extractTyped: ExtractTypedFn;

  constructor(config: ScanServiceConfig) {
    this.repoManager = config.repoManager;
    this.ai = config.ai;
    this.templates = config.templates;
    this.fillTemplate = config.fillTemplate;
    this.extractTyped = config.extractTyped;
  }

  /** Subset of dependencies forwarded to the aggregation helpers. */
  private get aggregationDeps(): AggregationDeps {
    return {
      ai: this.ai,
      templates: this.templates,
      fillTemplate: this.fillTemplate,
      extractTyped: this.extractTyped,
    };
  }

  /**
   * Execute a scan request.
   */
  async executeScan(
    request: ScanInput,
    onProgress: ProgressCallback
  ): Promise<ScanOutput> {
    const startTime = Date.now();
    const { topic, repositories, includePatterns, excludePatterns } = request;

    const repoSummaries: RepoScanSummary[] = [];
    const errors: { context: string; message: string; code?: string }[] = [];
    let totalFilesScanned = 0;
    let totalFindings = 0;

    for (let repoIndex = 0; repoIndex < repositories.length; repoIndex++) {
      const repo = repositories[repoIndex];
      const repoFullName = `${repo.owner}/${repo.name}`;

      onProgress({
        phase: "cloning",
        message: `Cloning ${repoFullName}...`,
        currentRepo: repoFullName,
        reposCompleted: repoIndex,
        totalRepos: repositories.length,
        filesScanned: totalFilesScanned,
        findingsCount: totalFindings,
      });

      try {
        const repoPath = await this.repoManager.ensureRepo({
          cloneUrl: repo.cloneUrl,
          branch: repo.defaultBranch ?? "main",
          owner: repo.owner,
          name: repo.name,
          useDefaultBranch: true,
        });

        onProgress({
          phase: "scanning",
          message: `Scanning files in ${repoFullName}...`,
          currentRepo: repoFullName,
          reposCompleted: repoIndex,
          totalRepos: repositories.length,
          filesScanned: totalFilesScanned,
          findingsCount: totalFindings,
        });

        const files = await this.findFilesToScan(
          repoPath,
          includePatterns ?? ["**/*.ts", "**/*.js", "**/*.py"],
          excludePatterns ?? ["**/node_modules/**", "**/.git/**"]
        );

        const repoFindings: ScanFinding[] = [];

        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          const filePath = files[fileIndex];
          const relativeFilePath = path.relative(repoPath, filePath);

          onProgress({
            phase: "analyzing",
            message: `Analyzing ${relativeFilePath} (${String(fileIndex + 1)}/${String(files.length)})`,
            currentRepo: repoFullName,
            currentFile: relativeFilePath,
            reposCompleted: repoIndex,
            totalRepos: repositories.length,
            filesScanned: totalFilesScanned + fileIndex,
            findingsCount: totalFindings + repoFindings.length,
          });

          try {
            const fileContent = await this.repoManager.readFile(
              repoPath,
              relativeFilePath
            );
            const findings = await this.analyzeFile(
              topic,
              relativeFilePath,
              fileContent,
              repoFullName
            );
            repoFindings.push(...findings);
          } catch (error) {
            const errorInfo = this.extractErrorInfo(error);
            errors.push({
              context: relativeFilePath,
              message: errorInfo.message,
              ...(errorInfo.code !== undefined &&
                errorInfo.code !== "" && { code: errorInfo.code }),
            });
          }
        }

        totalFilesScanned += files.length;
        totalFindings += repoFindings.length;

        onProgress({
          phase: "aggregating",
          message: `Creating summary for ${repoFullName}...`,
          currentRepo: repoFullName,
          reposCompleted: repoIndex,
          totalRepos: repositories.length,
          filesScanned: totalFilesScanned,
          findingsCount: totalFindings,
        });

        const repoSummary = await createRepoSummary(
          this.aggregationDeps,
          topic,
          repoFullName,
          repoFindings,
          files.length
        );
        repoSummaries.push(repoSummary);
      } catch {
        repoSummaries.push({
          repo: repoFullName,
          filesScanned: 0,
          findingsCount: 0,
          uniqueUseCases: [],
          findings: [],
        });
      }
    }

    onProgress({
      phase: "aggregating",
      message: "Creating overall summary...",
      reposCompleted: repositories.length,
      totalRepos: repositories.length,
      filesScanned: totalFilesScanned,
      findingsCount: totalFindings,
    });

    const overallSummary = await createOverallSummary(
      this.aggregationDeps,
      topic,
      repoSummaries
    );

    return {
      requestId: request.requestId,
      success: true,
      topic,
      reposScanned: repositories.length,
      filesScanned: totalFilesScanned,
      totalFindings,
      repoSummaries,
      overallSummary,
      durationMs: Date.now() - startTime,
      ...(errors.length > 0 && { errors }),
    };
  }

  private extractErrorInfo(error: unknown): { message: string; code?: string } {
    if (error instanceof Error) {
      const { cause } = error as { cause?: { code?: string } };
      const code =
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : undefined;
      return code !== undefined
        ? { message: error.message, code }
        : { message: error.message };
    }
    return { message: String(error) };
  }

  private async findFilesToScan(
    repoPath: string,
    includePatterns: string[],
    excludePatterns: string[]
  ): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of includePatterns) {
      const matches = await glob([pattern], {
        cwd: repoPath,
        absolute: true,
        onlyFiles: true,
        ignore: excludePatterns,
      });
      allFiles.push(...matches);
    }

    const uniqueFiles = [...new Set(allFiles)];

    return uniqueFiles.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return CODE_EXTENSIONS.has(ext);
    });
  }

  private async analyzeFile(
    topic: string,
    filePath: string,
    fileContent: string,
    repoName: string
  ): Promise<ScanFinding[]> {
    if (fileContent.length > MAX_FILE_SIZE || fileContent.length < 50) {
      return [];
    }

    const prompt = this.fillTemplate(this.templates.fileAnalysis, {
      topic,
      filePath,
      fileContent,
    });

    const response = await this.ai.chat(prompt).text();

    const findingSchema = {
      parse: (v: unknown) =>
        v as {
          findings: {
            description: string;
            lineNumber?: number;
            codeSnippet?: string;
          }[];
        },
    };

    const results = this.extractTyped(response, findingSchema, "NO_FINDINGS");
    if (results.length === 0) {
      return [];
    }

    return results[0].findings.map(
      (f): ScanFinding => ({
        repo: repoName,
        filePath,
        description: f.description,
        ...(f.lineNumber !== undefined && { lineNumber: f.lineNumber }),
        ...(f.codeSnippet !== undefined && { codeSnippet: f.codeSnippet }),
      })
    );
  }
}
