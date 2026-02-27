"use client";

import { type ReactNode, useState } from "react";

import { Badge } from "../content/Badge.js";

type ActivityItemVariant = "default" | "success" | "warning" | "error" | "info";

interface ActivityItemProps {
  icon?: ReactNode;
  summary: string;
  timestamp: string;
  badge?: string;
  variant?: ActivityItemVariant;
  actions?: ReactNode;
  children?: ReactNode;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {return "just now";}
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {return `${String(minutes)}m ago`;}
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {return `${String(hours)}h ago`;}
  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

const variantToBadge: Record<ActivityItemVariant, "default" | "success" | "warning" | "error" | "info"> = {
  default: "default",
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
};

const variantBorderLeft: Record<ActivityItemVariant, string> = {
  default: "border-l-2 border-l-[color:var(--color-border)]",
  success: "border-l-2 border-l-[color:var(--color-success)]",
  warning: "border-l-2 border-l-[color:var(--color-warning)]",
  error: "border-l-2 border-l-[color:var(--color-error)]",
  info: "border-l-2 border-l-[color:var(--color-info)]",
};

/** Collapsible activity/action row. Click to expand detail content. */
export function ActivityItem({
  icon,
  summary,
  timestamp,
  badge,
  variant = "default",
  actions,
  children,
}: ActivityItemProps) {
  const [open, setOpen] = useState(false);
  const hasDetail = children !== undefined;

  return (
    <div className={`${variantBorderLeft[variant]} border-b border-b-[color:var(--color-border)] last:border-b-0`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] ${hasDetail ? "cursor-pointer hover:bg-[color:var(--color-bg-muted)]" : ""} transition-colors select-none rounded-[var(--radius-sm)]`}
        onClick={hasDetail ? () => { setOpen((p) => !p); } : undefined}
      >
        {/* Expand chevron */}
        {hasDetail && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`flex-shrink-0 text-[color:var(--color-text-muted)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          >
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Icon */}
        {icon !== undefined && (
          <span className="flex-shrink-0 text-[color:var(--color-text-muted)]">{icon}</span>
        )}

        {/* Summary */}
        <span className="flex-1 text-[length:var(--text-sm)] text-[color:var(--color-text)] font-[family-name:var(--font-sans)] truncate">
          {summary}
        </span>

        {/* Badge */}
        {badge !== undefined && (
          <Badge variant={variantToBadge[variant]} size="sm">
            {badge}
          </Badge>
        )}

        {/* Timestamp */}
        <span
          className="flex-shrink-0 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)]"
          title={timestamp}
        >
          {formatRelativeTime(timestamp)}
        </span>

        {/* Actions */}
        {actions !== undefined && (
          <div
            className="flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); }}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && hasDetail && (
        <div className="px-[var(--space-3)] pb-[var(--space-2)] pl-[calc(var(--space-3)+12px+var(--space-2))]">
          {children}
        </div>
      )}
    </div>
  );
}
