export type LinkerPlatform = "slack" | "discord" | "markdown" | "plaintext";

export interface LinkerApplyOptions {
  /**
   * Target output format.
   * Alias: `platform`.
   * Default: "markdown"
   */
  format?: LinkerPlatform;
  platform?: LinkerPlatform;
  /**
   * When true (default), skips linkification inside inline/fenced code spans.
   */
  skipCode?: boolean;
  /**
   * When true (default), skips linkification inside existing links.
   */
  skipExistingLinks?: boolean;
}

export interface LinkMatchContext {
  /** Full regex match text. */
  match: string;
  /** Positional capture groups. */
  groups: string[];
  /** Rule name assigned at registration time. */
  ruleName: string;
  /** Match start index in the original input. */
  index: number;
  /** Original input string. */
  input: string;
}

export type LinkHrefBuilder = (context: LinkMatchContext) => string;

export interface LinkRule {
  /** Optional stable name for diagnostics and conflict visibility. */
  name?: string;
  /** Match pattern. Global matching is enforced automatically. */
  pattern: RegExp;
  /**
   * URL template string (supports $0/$& for full match, $1..$N for groups).
   * Convenience alias for `toHref`.
   */
  href?: string;
  /**
   * Either a URL template string or a callback that builds an href from match context.
   * If both `href` and `toHref` are provided, `toHref` wins.
   */
  toHref?: string | LinkHrefBuilder;
  /**
   * Higher priority wins for overlapping matches that start at the same index.
   * Default: 0
   */
  priority?: number;
}

interface CompiledRule {
  name: string;
  pattern: RegExp;
  priority: number;
  toHref: LinkHrefBuilder;
}

interface Span {
  start: number;
  end: number;
}

interface LinkCandidate {
  start: number;
  end: number;
  text: string;
  groups: string[];
  ruleOrder: number;
  ruleName: string;
  priority: number;
}

function ensureGlobal(pattern: RegExp): RegExp {
  if (pattern.flags.includes("g")) {
    return new RegExp(pattern.source, pattern.flags);
  }
  return new RegExp(pattern.source, `${pattern.flags}g`);
}

function templateToHref(template: string): LinkHrefBuilder {
  return ({ match, groups }: LinkMatchContext): string =>
    template.replace(/\$\$|\$(\d+|&|0)/g, (token, capture: string): string => {
      if (token === "$$") {
        return "$";
      }
      if (capture === "&" || capture === "0") {
        return match;
      }
      const index = Number(capture);
      if (!Number.isInteger(index) || index < 0) {
        return "";
      }
      return groups[index - 1] ?? "";
    });
}

function compileRule(rule: LinkRule, index: number): CompiledRule {
  const source = rule.toHref ?? rule.href;
  if (source === undefined) {
    throw new Error(
      `Invalid linker rule "${rule.name ?? `rule-${String(index + 1)}`}": missing href/toHref`
    );
  }
  const toHref = typeof source === "string" ? templateToHref(source) : source;
  return {
    name: rule.name ?? `rule-${String(index + 1)}`,
    pattern: ensureGlobal(rule.pattern),
    priority: rule.priority ?? 0,
    toHref,
  };
}

function pushSpans(source: string, pattern: RegExp, spans: Span[]): void {
  const matcher = ensureGlobal(pattern);
  let match: RegExpExecArray | null = matcher.exec(source);
  while (match !== null) {
    if (match[0].length === 0) {
      matcher.lastIndex += 1;
      match = matcher.exec(source);
      continue;
    }
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
    });
    match = matcher.exec(source);
  }
}

function normalizeSpans(spans: Span[]): Span[] {
  if (spans.length <= 1) {
    return spans;
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Span[] = [spans[0]];
  for (let i = 1; i < spans.length; i++) {
    const current = spans[i];
    const previous = merged[merged.length - 1];
    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }
    merged.push(current);
  }
  return merged;
}

function getProtectedSpans(
  input: string,
  options: Required<Pick<LinkerApplyOptions, "skipCode" | "skipExistingLinks">>
): Span[] {
  const spans: Span[] = [];
  if (options.skipCode) {
    // Fenced code blocks first, then inline spans.
    pushSpans(input, /```[\s\S]*?```/g, spans);
    pushSpans(input, /`[^`\n]+`/g, spans);
  }
  if (options.skipExistingLinks) {
    // Slack and angle-bracket links/mentions.
    pushSpans(input, /<[^>\n]+>/g, spans);
    // Markdown links.
    pushSpans(input, /\[[^\]]+\]\([^)]+\)/g, spans);
    // Plain URLs.
    pushSpans(input, /https?:\/\/[^\s<>()]+/g, spans);
  }
  return normalizeSpans(spans);
}

function overlapsProtected(spans: Span[], start: number, end: number): boolean {
  for (const span of spans) {
    if (span.end <= start) {
      continue;
    }
    if (span.start >= end) {
      return false;
    }
    return true;
  }
  return false;
}

function formatLink(
  href: string,
  text: string,
  platform: LinkerPlatform
): string {
  switch (platform) {
    case "slack":
      return `<${href}|${text}>`;
    case "discord":
    case "markdown":
      return `[${text}](${href})`;
    case "plaintext":
      return href;
    default:
      return text;
  }
}

function resolvePlatform(options: LinkerApplyOptions): LinkerPlatform {
  return options.format ?? options.platform ?? "markdown";
}

export class Linker {
  private readonly rules: CompiledRule[] = [];

  constructor(initialRules: LinkRule[] = []) {
    for (const rule of initialRules) {
      this.addRule(rule);
    }
  }

  private addRule(rule: LinkRule): this {
    this.rules.push(compileRule(rule, this.rules.length));
    return this;
  }

  rule(rule: LinkRule): this;
  rule(name: string, rule: Omit<LinkRule, "name">): this;
  rule(
    ruleOrName: LinkRule | string,
    maybeRule?: Omit<LinkRule, "name">
  ): this {
    if (typeof ruleOrName === "string") {
      if (maybeRule === undefined) {
        throw new Error(`Missing rule config for "${ruleOrName}"`);
      }
      return this.addRule({ ...maybeRule, name: ruleOrName });
    }
    return this.addRule(ruleOrName);
  }

  custom(
    pattern: RegExp,
    toHref: string | LinkHrefBuilder,
    options: { name?: string; priority?: number } = {}
  ): this {
    return this.addRule({
      name: options.name,
      pattern,
      toHref,
      priority: options.priority,
    });
  }

  linear(
    workspace: string,
    options: { name?: string; priority?: number } = {}
  ): this {
    return this.custom(
      /\b([A-Z]{2,6}-\d+)\b/g,
      ({ match }) => `https://linear.app/${workspace}/issue/${match}`,
      { name: options.name ?? "linear", priority: options.priority }
    );
  }

  githubPr(
    repository: string,
    options: { name?: string; priority?: number } = {}
  ): this {
    return this.custom(
      /\bPR#(\d+)\b/g,
      ({ groups }) => `https://github.com/${repository}/pull/${groups[0] ?? ""}`,
      { name: options.name ?? "github-pr", priority: options.priority }
    );
  }

  apply(input: string, options: LinkerApplyOptions = {}): string {
    return this.linkText(input, options);
  }

  linkText(input: string, options: LinkerApplyOptions = {}): string {
    if (this.rules.length === 0 || input === "") {
      return input;
    }

    const platform = resolvePlatform(options);
    const protectedSpans = getProtectedSpans(input, {
      skipCode: options.skipCode ?? true,
      skipExistingLinks: options.skipExistingLinks ?? true,
    });

    const candidates: LinkCandidate[] = [];
    for (let ruleOrder = 0; ruleOrder < this.rules.length; ruleOrder++) {
      const rule = this.rules[ruleOrder];
      const matcher = ensureGlobal(rule.pattern);
      let match: RegExpExecArray | null = matcher.exec(input);
      while (match !== null) {
        const matchedText = match[0];
        if (matchedText.length === 0) {
          matcher.lastIndex += 1;
          match = matcher.exec(input);
          continue;
        }
        const start = match.index;
        const end = start + matchedText.length;
        if (!overlapsProtected(protectedSpans, start, end)) {
          candidates.push({
            start,
            end,
            text: matchedText,
            groups: match.slice(1).map((value) => value ?? ""),
            ruleOrder,
            ruleName: rule.name,
            priority: rule.priority,
          });
        }
        match = matcher.exec(input);
      }
    }

    if (candidates.length === 0) {
      return input;
    }

    candidates.sort(
      (a, b) =>
        a.start - b.start ||
        b.priority - a.priority ||
        b.end - b.start - (a.end - a.start) ||
        b.ruleOrder - a.ruleOrder
    );

    const selected: LinkCandidate[] = [];
    let cursorEnd = -1;
    for (const candidate of candidates) {
      if (candidate.start < cursorEnd) {
        continue;
      }
      selected.push(candidate);
      cursorEnd = candidate.end;
    }

    let output = "";
    let inputCursor = 0;
    for (const candidate of selected) {
      output += input.slice(inputCursor, candidate.start);
      const rule = this.rules[candidate.ruleOrder];
      const href = rule.toHref({
        match: candidate.text,
        groups: candidate.groups,
        ruleName: candidate.ruleName,
        index: candidate.start,
        input,
      });
      if (href === "") {
        output += candidate.text;
      } else {
        output += formatLink(href, candidate.text, platform);
      }
      inputCursor = candidate.end;
    }
    output += input.slice(inputCursor);
    return output;
  }
}

export function createLinker(initialRules: LinkRule[] = []): Linker {
  return new Linker(initialRules);
}
