"use client";

import { type ReactNode, useState } from "react";

type CodeBlockVariant = "default" | "error";

interface CodeBlockProps {
  children: string;
  maxHeight?: string;
  variant?: CodeBlockVariant;
  wrap?: boolean;
  language?: string;
}

const variantStyles: Record<CodeBlockVariant, string> = {
  default: "bg-[color:var(--color-bg-subtle)]",
  error: "bg-[color:var(--color-error-subtle)]",
};

// --- Lightweight syntax highlighter (no external deps) ---

interface TokenRule {
  pattern: RegExp;
  className: string;
}

const JS_TS_RULES: TokenRule[] = [
  // Block comments
  { pattern: /\/\*[\s\S]*?\*\//g, className: "text-[color:var(--color-text-muted)]" },
  // Line comments
  { pattern: /\/\/.*/g, className: "text-[color:var(--color-text-muted)]" },
  // Strings (double, single, backtick)
  { pattern: /`(?:[^`\\]|\\.)*`/g, className: "text-[color:var(--color-success)]" },
  { pattern: /"(?:[^"\\]|\\.)*"/g, className: "text-[color:var(--color-success)]" },
  { pattern: /'(?:[^'\\]|\\.)*'/g, className: "text-[color:var(--color-success)]" },
  // Numbers
  { pattern: /\b(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/g, className: "text-[color:var(--color-warning)]" },
  // TS types / keywords
  { pattern: /\b(?:string|number|boolean|void|null|undefined|never|any|unknown|bigint|symbol|object|keyof|typeof|infer|readonly)\b/g, className: "text-[color:var(--color-info)]" },
  // Keywords
  { pattern: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|delete|in|of|class|extends|implements|import|export|from|default|type|interface|enum|async|await|yield|static|get|set|super|this|as|is|satisfies)\b/g, className: "text-[color:var(--color-accent)]" },
  // Booleans
  { pattern: /\b(?:true|false)\b/g, className: "text-[color:var(--color-warning)]" },
];

const LANGUAGE_RULES: Record<string, TokenRule[]> = {
  typescript: JS_TS_RULES,
  ts: JS_TS_RULES,
  javascript: JS_TS_RULES,
  js: JS_TS_RULES,
  tsx: JS_TS_RULES,
  jsx: JS_TS_RULES,
};

interface Token {
  text: string;
  className?: string;
}

function tokenize(line: string, rules: TokenRule[]): Token[] {
  // Collect all matches with their positions
  const matches: { start: number; end: number; className: string }[] = [];

  for (const rule of rules) {
    // Reset lastIndex for global regexes
    rule.pattern.lastIndex = 0;
    let match = rule.pattern.exec(line);
    while (match !== null) {
      matches.push({ start: match.index, end: match.index + match[0].length, className: rule.className });
      match = rule.pattern.exec(line);
    }
  }

  // Sort by start position; earlier rules win ties (comments > strings > keywords)
  matches.sort((a, b) => a.start - b.start);

  // Build non-overlapping tokens
  const tokens: Token[] = [];
  let pos = 0;

  for (const m of matches) {
    if (m.start < pos) {continue;} // Skip overlapping
    if (m.start > pos) {
      tokens.push({ text: line.slice(pos, m.start) });
    }
    tokens.push({ text: line.slice(m.start, m.end), className: m.className });
    pos = m.end;
  }

  if (pos < line.length) {
    tokens.push({ text: line.slice(pos) });
  }

  return tokens;
}

function highlightLine(line: string, language: string | undefined): ReactNode {
  const rules = language !== undefined ? LANGUAGE_RULES[language.toLowerCase()] : undefined;
  if (rules === undefined || line.length === 0) {
    return line || "\n";
  }

  const tokens = tokenize(line, rules);
  if (tokens.length === 1 && tokens[0].className === undefined) {
    return line;
  }

  return tokens.map((token, i) =>
    token.className !== undefined
      ? <span key={i} className={token.className}>{token.text}</span>
      : <span key={i}>{token.text}</span>,
  );
}

// --- Component ---

/** Code block with line numbers, copy button, syntax highlighting, and optional language label. */
export function CodeBlock({
  children,
  maxHeight,
  variant = "default",
  wrap = false,
  language,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    });
  }

  const lines = children.split("\n");
  // Remove trailing empty line if content ends with newline
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const gutterWidth = String(lines.length).length;

  return (
    <div className={`relative group rounded-[var(--radius-md)] overflow-hidden ${variantStyles[variant]}`}>
      {/* Top bar: language label + copy button */}
      <div className="flex items-center justify-between px-4 pt-2 pb-0">
        <span className="text-[10px] font-medium text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)] uppercase tracking-wider">
          {language ?? ""}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[10px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-1.5 py-0.5 rounded-[var(--radius-sm)] hover:bg-[color:rgba(255,255,255,0.06)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className={`px-4 pb-3 pt-2 text-xs font-[family-name:var(--font-mono)] leading-[1.7] overflow-x-auto ${wrap ? "whitespace-pre-wrap" : ""}`}
        style={maxHeight !== undefined && maxHeight !== "" ? { maxHeight, overflowY: "auto" } : undefined}
      >
        <code className="text-[color:var(--color-text)]">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span
                className="select-none text-right pr-4 text-[color:var(--color-text-muted)] shrink-0"
                style={{ minWidth: `${String(gutterWidth + 1)}ch` }}
              >
                {i + 1}
              </span>
              <span className={wrap ? "break-all" : ""}>{highlightLine(line, language)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
