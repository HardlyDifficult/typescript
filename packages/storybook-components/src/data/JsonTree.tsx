"use client";

import { type ReactNode, useState } from "react";

interface JsonTreeProps {
  /** The data to display. Accepts any JSON-serializable value. */
  data: unknown;
  /** Expand all nodes to this depth (0 = collapse everything, 1 = top-level expanded). Default: 1. */
  defaultExpandDepth?: number;
  /** Root label shown before the top-level value. */
  label?: string;
}

/** Inline chevron for expand/collapse toggle. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`inline-block mr-0.5 text-[color:var(--color-text-muted)] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Colored value display based on type. */
function ValueSpan({ value }: { value: unknown }): ReactNode {
  if (value === null) {
    return <span className="text-[color:var(--color-text-muted)] italic">null</span>;
  }
  if (value === undefined) {
    return <span className="text-[color:var(--color-text-muted)] italic">undefined</span>;
  }
  if (typeof value === "string") {
    return <span className="text-[color:var(--color-success)]">&quot;{value}&quot;</span>;
  }
  if (typeof value === "number") {
    return <span className="text-[color:var(--color-warning)]">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-[color:var(--color-warning)]">{String(value)}</span>;
  }
  return <span>{JSON.stringify(value)}</span>;
}

/** Summary shown when a node is collapsed: `{3 keys}` or `[5 items]`. */
function collapsedPreview(value: unknown): string {
  if (Array.isArray(value)) {
    const len = value.length;
    return `[${String(len)} item${len !== 1 ? "s" : ""}]`;
  }
  if (typeof value === "object" && value !== null) {
    const len = Object.keys(value as Record<string, unknown>).length;
    return `{${String(len)} key${len !== 1 ? "s" : ""}}`;
  }
  return "";
}

function isExpandable(value: unknown): boolean {
  if (value === null || value === undefined) {return false;}
  if (typeof value !== "object") {return false;}
  if (Array.isArray(value)) {return value.length > 0;}
  return Object.keys(value as Record<string, unknown>).length > 0;
}

interface NodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  defaultExpandDepth: number;
  isLast: boolean;
}

function JsonNode({ keyName, value, depth, defaultExpandDepth, isLast }: NodeProps) {
  const expandable = isExpandable(value);
  const [open, setOpen] = useState(depth < defaultExpandDepth);

  const indent = depth * 16;
  const comma = isLast ? "" : ",";

  if (!expandable) {
    return (
      <div className="flex" style={{ paddingLeft: `${String(indent)}px` }}>
        <span className="whitespace-pre">
          {/* Spacer for alignment with chevrons */}
          <span className="inline-block" style={{ width: "14px" }} />
          {keyName !== undefined && (
            <><span className="text-[color:var(--color-accent)]">{keyName}</span>: </>
          )}
          <ValueSpan value={value} />{comma}
        </span>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  if (!open) {
    return (
      <div
        className="flex cursor-pointer hover:bg-[color:var(--color-bg-muted)] rounded-[var(--radius-sm)]"
        style={{ paddingLeft: `${String(indent)}px` }}
        onClick={() => { setOpen(true); }}
      >
        <span className="whitespace-pre">
          <Chevron open={false} />
          {keyName !== undefined && (
            <><span className="text-[color:var(--color-accent)]">{keyName}</span>: </>
          )}
          <span className="text-[color:var(--color-text-muted)]">
            {openBracket} {collapsedPreview(value)} {closeBracket}
          </span>{comma}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex cursor-pointer hover:bg-[color:var(--color-bg-muted)] rounded-[var(--radius-sm)]"
        style={{ paddingLeft: `${String(indent)}px` }}
        onClick={() => { setOpen(false); }}
      >
        <span className="whitespace-pre">
          <Chevron open={true} />
          {keyName !== undefined && (
            <><span className="text-[color:var(--color-accent)]">{keyName}</span>: </>
          )}
          {openBracket}
        </span>
      </div>
      {entries.map(([k, v], i) => (
        <JsonNode
          key={k}
          keyName={isArray ? undefined : k}
          value={v}
          depth={depth + 1}
          defaultExpandDepth={defaultExpandDepth}
          isLast={i === entries.length - 1}
        />
      ))}
      <div style={{ paddingLeft: `${String(indent)}px` }}>
        <span className="whitespace-pre">
          <span className="inline-block" style={{ width: "14px" }} />
          {closeBracket}{comma}
        </span>
      </div>
    </div>
  );
}

/** Interactive JSON tree viewer with expand/collapse for objects and arrays. */
export function JsonTree({ data, defaultExpandDepth = 1, label }: JsonTreeProps) {
  return (
    <div className="text-xs font-[family-name:var(--font-mono)] leading-[1.7] text-[color:var(--color-text)] py-1">
      {label !== undefined && (
        <div className="text-[color:var(--color-text-muted)] mb-1 font-[family-name:var(--font-sans)] text-[10px] font-medium uppercase tracking-wider">
          {label}
        </div>
      )}
      <JsonNode
        value={data}
        depth={0}
        defaultExpandDepth={defaultExpandDepth}
        isLast={true}
      />
    </div>
  );
}
