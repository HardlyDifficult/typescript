"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { JsonTree } from "../data/JsonTree.js";
import { Input } from "../inputs/Input.js";
import { Tabs } from "../navigation/Tabs.js";

type ViewMode = "text" | "markdown" | "json";

interface TextViewerProps {
  content?: string;
  json?: unknown;
  onChange?: (value: string) => void;
  maxHeight?: string;
  defaultMode?: ViewMode;
  placeholder?: string;
  autoScroll?: boolean;
}

function tryParseJson(content: string): unknown {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

const markdownClass = [
  "font-[family-name:var(--font-sans)] text-[color:var(--color-text)] leading-relaxed",
  "text-[length:var(--text-sm)]",
  "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-[color:var(--color-text)] [&_h1]:mt-6 [&_h1]:mb-3",
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[color:var(--color-text)] [&_h2]:mt-5 [&_h2]:mb-2",
  "[&_h3]:text-[length:var(--text-base)] [&_h3]:font-semibold [&_h3]:text-[color:var(--color-text)] [&_h3]:mt-4 [&_h3]:mb-1.5",
  "[&_>h1:first-child]:mt-0 [&_>h2:first-child]:mt-0 [&_>h3:first-child]:mt-0",
  "[&_p]:my-3 [&_p]:leading-[1.7]",
  "[&_code]:bg-[color:rgba(255,255,255,0.04)] [&_code]:px-[0.4em] [&_code]:py-[0.15em] [&_code]:rounded-[var(--radius-sm)] [&_code]:text-[0.9em] [&_code]:font-[family-name:var(--font-mono)] [&_code]:text-[color:var(--color-accent)]",
  "[&_pre]:bg-[color:var(--color-bg-subtle)] [&_pre]:rounded-[var(--radius-md)] [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-[0.85em] [&_pre]:my-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[color:var(--color-text)]",
  "[&_ul]:pl-6 [&_ol]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:my-1 [&_li]:leading-[1.6] [&_ul]:my-2 [&_ol]:my-2",
  "[&_blockquote]:border-l-[2px] [&_blockquote]:border-[color:var(--color-border)] [&_blockquote]:pl-3 [&_blockquote]:text-[color:var(--color-text-secondary)] [&_blockquote]:my-2 [&_blockquote]:italic",
  "[&_a]:text-[color:var(--color-accent)] [&_a]:no-underline [&_a:hover]:underline",
  "[&_hr]:border-none [&_hr]:border-t [&_hr]:border-[color:var(--color-border)] [&_hr]:my-4",
  "[&_table]:border-collapse [&_table]:w-full [&_table]:my-2",
  "[&_th]:border [&_th]:border-[color:var(--color-border)] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:bg-[color:var(--color-bg-subtle)] [&_th]:font-medium [&_th]:text-[0.85em]",
  "[&_td]:border [&_td]:border-[color:var(--color-border)] [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-left [&_td]:text-sm",
  "[&_img]:rounded-[var(--radius-md)] [&_img]:my-3",
  "[&_strong]:font-semibold [&_strong]:text-[color:var(--color-text)]",
].join(" ");

/**
 * Multi-mode content viewer with text, json, and markdown tabs.
 * The json tab renders an interactive expand/collapse tree.
 * When `onChange` is provided, text mode becomes an editable textarea.
 */
export function TextViewer({
  content,
  json,
  onChange,
  maxHeight,
  defaultMode = json !== undefined ? "json" : "text",
  placeholder,
  autoScroll = false,
}: TextViewerProps): ReactNode {
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [autoScroll, content, json]);

  const resolvedContent = content ?? "";
  const parsedJson: unknown = json ?? tryParseJson(resolvedContent);
  const showJsonTab = parsedJson !== null;
  const showMarkdownTab = json === undefined;

  // In text mode, show the formatted JSON when json prop is the source
  const displayText = json !== undefined ? JSON.stringify(json, null, 2) : resolvedContent;
  const copyText = displayText;

  function handleCopy() {
    void navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    });
  }

  const tabs = [
    { value: "text", label: "Text" },
    ...(showJsonTab ? [{ value: "json", label: "JSON" }] : []),
    ...(showMarkdownTab ? [{ value: "markdown", label: "Markdown" }] : []),
  ];

  const scrollStyle = maxHeight !== undefined ? { maxHeight, overflow: "auto" as const } : undefined;

  let body: ReactNode;

  if (mode === "json" && parsedJson !== null) {
    body = (
      <div ref={scrollRef} style={scrollStyle}>
        <JsonTree data={parsedJson} defaultExpandDepth={2} />
      </div>
    );
  } else if (mode === "markdown") {
    body = (
      <div ref={scrollRef} style={scrollStyle}>
        <div className={markdownClass}>
          <ReactMarkdown>{resolvedContent}</ReactMarkdown>
        </div>
      </div>
    );
  } else {
    body = onChange !== undefined ? (
      <Input
        multiline
        value={displayText}
        onChange={onChange}
        placeholder={placeholder}
      />
    ) : (
      <div ref={scrollRef} style={scrollStyle}>
        <pre className="text-xs font-[family-name:var(--font-mono)] text-[color:var(--color-text)] bg-[color:var(--color-bg-subtle)] rounded-[var(--radius-md)] p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {displayText !== "" ? displayText : (placeholder ?? "")}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <Tabs tabs={tabs} value={mode} onChange={(v) => { setMode(v as ViewMode); }} />
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)] opacity-40 hover:opacity-100 transition-opacity duration-150 px-1.5 py-0.5 rounded-[var(--radius-sm)] hover:bg-[color:rgba(255,255,255,0.06)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {body}
    </div>
  );
}
