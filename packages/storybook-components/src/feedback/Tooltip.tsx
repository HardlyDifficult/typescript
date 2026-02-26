"use client";

import { type ReactNode, useState } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
}

/** Hover tooltip that displays help text above the trigger element. */
export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block", cursor: "help" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            maxWidth: "280px",
            width: "max-content",
            padding: "6px 10px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-subtle)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-sans)",
            lineHeight: "1.4",
            boxShadow: "var(--shadow-md)",
            pointerEvents: "none",
          }}
        >
          {content}
        </div>
      )}
    </span>
  );
}
