"use client";

import { type MouseEvent, type ReactNode, useState } from "react";

interface CollapsibleProps {
  title: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

/** Expandable section — no border or background on wrapper. */
export function Collapsible({
  title,
  defaultOpen = false,
  actions,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  function handleActionsClick(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div>
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center cursor-pointer hover:bg-[color:var(--color-bg-muted)] transition-colors select-none rounded-[var(--radius-sm)]"
        onClick={() => { setOpen((prev) => !prev); }}
      >
        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`mr-2 flex-shrink-0 text-[color:var(--color-text-muted)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Title */}
        <span className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)] flex-1">
          {title}
        </span>

        {/* Actions */}
        {actions !== undefined && (
          <div className="ml-3" onClick={handleActionsClick}>{actions}</div>
        )}
      </div>

      {/* Body — indented under the chevron so the heading stays put */}
      {open && <div className="pl-[1.625rem] pt-1">{children}</div>}
    </div>
  );
}
