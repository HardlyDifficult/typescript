"use client";

import { useState } from "react";

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

/** Code block with line numbers, copy button, and optional language label. */
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
              <span className={wrap ? "break-all" : ""}>{line || "\n"}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
