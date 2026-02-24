import type { ReactNode } from "react";

type TextVariant = "heading" | "subheading" | "body" | "caption" | "code";

interface TextProps {
  variant?: TextVariant;
  children: ReactNode;
}

const variantStyles: Record<TextVariant, string> = {
  heading:
    "text-[length:var(--text-2xl)] font-semibold text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[1.22] tracking-[var(--tracking-tighter)]",
  subheading:
    "text-[length:var(--text-lg)] font-semibold text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[var(--leading-snug)] tracking-[var(--tracking-tight)]",
  body:
    "text-[length:var(--text-base)] text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)] leading-[1.66]",
  caption:
    "text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-medium font-[family-name:var(--font-sans)] leading-[var(--leading-normal)]",
  code:
    "text-[length:var(--text-sm)] font-[family-name:var(--font-mono)] text-[color:var(--color-accent-hover)] bg-[color:var(--color-accent-subtle)] px-[var(--space-2)] py-0.5 rounded-[var(--radius-md)]",
};

const defaultElements: Record<TextVariant, keyof HTMLElementTagNameMap> = {
  heading:    "h2",
  subheading: "h3",
  body:       "p",
  caption:    "span",
  code:       "code",
};

/** Typography primitive with heading, body, caption, and code variants. */
export function Text({ variant = "body", children }: TextProps) {
  const Element = defaultElements[variant];
  return <Element className={variantStyles[variant]}>{children}</Element>;
}
