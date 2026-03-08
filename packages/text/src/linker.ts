export type LinkStyle = "slack" | "discord" | "markdown" | "plain";

export interface LinkOptions {
  /**
   * Target output style.
   * Default: "markdown"
   */
  for?: LinkStyle;
  /**
   * When true (default), skips linkification inside inline/fenced code spans.
   */
  ignoreCode?: boolean;
  /**
   * When true (default), skips linkification inside existing links.
   */
  ignoreExistingLinks?: boolean;
}

export interface LinkContext {
  /** Full matched text. */
  text: string;
  /** Positional capture groups. */
  groups: string[];
  /** Rule name assigned at registration time. */
  name: string;
  /** Match start index in the original input. */
  index: number;
  /** Original input string. */
  input: string;
}

export type LinkTarget = (context: LinkContext) => string;

export interface LinkRule {
  /** Optional stable name for diagnostics and conflict visibility. */
  name?: string;
  /** Match pattern. Global matching is enforced automatically. */
  match: RegExp;
  /**
   * Either a URL template string or a callback that builds a URL from match
   * context. Template strings support `$0`/`$&` for the full match and
   * `$1..$N` for groups.
   */
  to: string | LinkTarget;
  /**
   * Higher priority wins for overlapping matches that start at the same index.
   * Default: 0
   */
  priority?: number;
}

export interface LinkerConfig {
  /** Linear workspace slug, used for issue references like `ENG-533`. */
  linear?: string;
  /** GitHub repository for PR references like `PR#42`. */
  githubPrs?: string;
  /** Additional custom rules appended after built-in presets. */
  rules?: readonly LinkRule[];
}

export interface LinkTextOptions extends LinkerConfig, LinkOptions {}

interface CompiledRule {
  name: string;
  match: RegExp;
  priority: number;
  to: LinkTarget;
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
  name: string;
  priority: number;
}

function ensureGlobal(pattern: RegExp): RegExp {
  if (pattern.flags.includes("g")) {
    return new RegExp(pattern.source, pattern.flags);
  }
  return new RegExp(pattern.source, `${pattern.flags}g`);
}

function templateToTarget(template: string): LinkTarget {
  return ({ text, groups }: LinkContext): string =>
    template.replace(/\$\$|\$(\d+|&|0)/g, (token, capture: string): string => {
      if (token === "$$") {
        return "$";
      }
      if (capture === "&" || capture === "0") {
        return text;
      }
      const index = Number(capture);
      if (!Number.isInteger(index) || index < 0) {
        return "";
      }
      return groups[index - 1] ?? "";
    });
}

function compileRule(rule: LinkRule, index: number): CompiledRule {
  return {
    name: rule.name ?? `rule-${String(index + 1)}`,
    match: ensureGlobal(rule.match),
    priority: rule.priority ?? 0,
    to: typeof rule.to === "string" ? templateToTarget(rule.to) : rule.to,
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
  options: Required<Pick<LinkOptions, "ignoreCode" | "ignoreExistingLinks">>
): Span[] {
  const spans: Span[] = [];
  if (options.ignoreCode) {
    pushSpans(input, /```[\s\S]*?```/g, spans);
    pushSpans(input, /`[^`\n]+`/g, spans);
  }
  if (options.ignoreExistingLinks) {
    pushSpans(input, /<[^>\n]+>/g, spans);
    pushSpans(input, /\[[^\]]+\]\([^)]+\)/g, spans);
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

function formatLink(href: string, text: string, style: LinkStyle): string {
  switch (style) {
    case "slack":
      return `<${href}|${text}>`;
    case "discord":
    case "markdown":
      return `[${text}](${href})`;
    case "plain":
      return href;
    default:
      return text;
  }
}

function buildRules(config: LinkerConfig): CompiledRule[] {
  const rules: LinkRule[] = [];

  if (config.linear !== undefined && config.linear !== "") {
    rules.push({
      name: "linear",
      match: /\b([A-Z]{2,6}-\d+)\b/g,
      to: ({ text }) => `https://linear.app/${config.linear}/issue/${text}`,
    });
  }

  if (config.githubPrs !== undefined && config.githubPrs !== "") {
    rules.push({
      name: "github-prs",
      match: /\bPR#(\d+)\b/g,
      to: ({ groups }) =>
        `https://github.com/${config.githubPrs}/pull/${groups[0] ?? ""}`,
    });
  }

  rules.push(...(config.rules ?? []));

  return rules.map(compileRule);
}

/**
 * Compiled linker utility.
 *
 * Built-in presets cover the repo references used in this workspace.
 * For one-off usage, prefer the top-level `linkText()` helper.
 */
export class Linker {
  private readonly rules: CompiledRule[];

  constructor(config: LinkerConfig = {}) {
    this.rules = buildRules(config);
  }

  link(input: string, options: LinkOptions = {}): string {
    if (this.rules.length === 0 || input === "") {
      return input;
    }

    const style = options.for ?? "markdown";
    const protectedSpans = getProtectedSpans(input, {
      ignoreCode: options.ignoreCode ?? true,
      ignoreExistingLinks: options.ignoreExistingLinks ?? true,
    });

    const candidates: LinkCandidate[] = [];
    for (let ruleOrder = 0; ruleOrder < this.rules.length; ruleOrder++) {
      const rule = this.rules[ruleOrder];
      const matcher = rule.match;
      matcher.lastIndex = 0;
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
            groups: match.slice(1),
            ruleOrder,
            name: rule.name,
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
      const href = rule.to({
        text: candidate.text,
        groups: candidate.groups,
        name: candidate.name,
        index: candidate.start,
        input,
      });
      output += href === "" ? candidate.text : formatLink(href, candidate.text, style);
      inputCursor = candidate.end;
    }
    output += input.slice(inputCursor);
    return output;
  }
}

export function createLinker(config: LinkerConfig = {}): Linker {
  return new Linker(config);
}

export function linkText(input: string, options: LinkTextOptions = {}): string {
  const {
    linear,
    githubPrs,
    rules,
    for: style,
    ignoreCode,
    ignoreExistingLinks,
  } = options;

  const linker = createLinker({ linear, githubPrs, rules });
  return linker.link(input, {
    for: style,
    ignoreCode,
    ignoreExistingLinks,
  });
}
