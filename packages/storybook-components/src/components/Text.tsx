import type { ReactNode } from "react";

type TextVariant = "heading" | "subheading" | "body" | "caption" | "code";

interface TextProps {
  variant?: TextVariant;
  as?: keyof HTMLElementTagNameMap;
  className?: string;
  children: ReactNode;
}

const variantStyles: Record<TextVariant, string> = {
  heading:
    "text-[length:var(--text-2xl)] font-semibold tracking-tight text-[color:var(--color-text)] font-[family-name:var(--font-sans)]",
  subheading:
    "text-[length:var(--text-lg)] font-medium text-[color:var(--color-text)] font-[family-name:var(--font-sans)]",
  body: "text-[length:var(--text-base)] text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)] leading-relaxed",
  caption:
    "text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)]",
  code: "text-[length:var(--text-sm)] font-[family-name:var(--font-mono)] text-[color:var(--color-accent)] bg-[color:var(--color-bg-muted)] px-[var(--space-1)] py-0.5 rounded-[var(--radius-sm)]",
};

const defaultElements: Record<TextVariant, keyof HTMLElementTagNameMap> = {
  heading: "h2",
  subheading: "h3",
  body: "p",
  caption: "span",
  code: "code",
};

/** Typography primitive with heading, body, caption, and code variants. */
export function Text({
  variant = "body",
  as,
  className = "",
  children,
}: TextProps) {
  const Element = as ?? defaultElements[variant];
  const styles = variantStyles[variant];
  return <Element className={`${styles} ${className}`.trim()}>{children}</Element>;
}
