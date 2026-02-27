import type { ReactNode } from "react";

type TextVariant = "heading" | "subheading" | "body" | "caption" | "code";
type TextColor = "default" | "secondary" | "muted" | "success" | "error" | "info" | "accent";

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  children: ReactNode;
}

const variantBase: Record<TextVariant, string> = {
  heading:
    "text-xl font-semibold font-[family-name:var(--font-sans)] leading-[1.22] tracking-[var(--tracking-tighter)]",
  subheading:
    "text-xs font-medium uppercase tracking-[0.05em] font-[family-name:var(--font-sans)] leading-[var(--leading-snug)]",
  body:
    "text-sm font-[family-name:var(--font-sans)] leading-[1.6] tracking-[0.01em]",
  caption:
    "text-xs font-normal font-[family-name:var(--font-sans)] leading-[var(--leading-normal)]",
  code:
    "text-xs font-[family-name:var(--font-mono)] bg-[color:rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded-[var(--radius-sm)]",
};

const variantDefaultColor: Record<TextVariant, string> = {
  heading:    "text-[color:var(--color-text)]",
  subheading: "text-[color:var(--color-text-muted)]",
  body:       "text-[color:var(--color-text)]",
  caption:    "text-[color:var(--color-text-muted)]",
  code:       "text-[color:var(--color-text)]",
};

const defaultElements: Record<TextVariant, keyof HTMLElementTagNameMap> = {
  heading:    "h2",
  subheading: "h3",
  body:       "p",
  caption:    "span",
  code:       "code",
};

const colorStyles: Record<TextColor, string> = {
  default:   "text-[color:var(--color-text)]",
  secondary: "text-[color:var(--color-text-secondary)]",
  muted:     "text-[color:var(--color-text-muted)]",
  success:   "text-[color:var(--color-success)]",
  error:     "text-[color:var(--color-error)]",
  info:      "text-[color:var(--color-info)]",
  accent:    "text-[color:var(--color-accent)]",
};

/** Typography primitive with heading, subheading, body, caption, and code variants. */
export function Text({ variant = "body", color, children }: TextProps) {
  const Element = defaultElements[variant];
  const colorClass = color !== undefined ? colorStyles[color] : variantDefaultColor[variant];
  return <Element className={`${variantBase[variant]} ${colorClass}`}>{children}</Element>;
}
