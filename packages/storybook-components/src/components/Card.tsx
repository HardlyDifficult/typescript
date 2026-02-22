import type { ReactNode } from "react";

type CardPadding = "sm" | "md" | "lg";

interface CardProps {
  padding?: CardPadding;
  className?: string;
  children: ReactNode;
}

const paddingStyles: Record<CardPadding, string> = {
  sm: "p-[var(--space-3)]",
  md: "p-[var(--space-4)]",
  lg: "p-[var(--space-6)]",
};

/** Container with border, background, and configurable padding. */
export function Card({ padding = "md", className = "", children }: CardProps) {
  return (
    <div
      className={`bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] ${paddingStyles[padding]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
