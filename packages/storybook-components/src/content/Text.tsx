import type { ReactNode } from "react";

type TextVariant = "heading" | "subheading" | "body" | "caption" | "code";
type TextColor = "default" | "secondary" | "muted" | "success" | "error" | "info" | "accent";

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: "medium" | "semibold" | "bold";
  mono?: boolean;
  truncate?: boolean;
  align?: "left" | "center" | "right";
  /** When provided, renders as an anchor tag */
  href?: string;
  /** Opens the link in a new tab */
  external?: boolean;
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

const weightStyles: Record<"medium" | "semibold" | "bold", string> = {
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const alignStyles: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Typography primitive with heading, subheading, body, caption, and code variants. Renders as an anchor when `href` is provided. */
export function Text({ variant = "body", color, weight, mono = false, truncate = false, align, href, external = false, children }: TextProps) {
  const colorClass = color !== undefined ? colorStyles[color] : variantDefaultColor[variant];
  const weightClass = weight !== undefined ? weightStyles[weight] : "";
  const monoClass = mono ? "font-[family-name:var(--font-mono)]" : "";
  const truncateClass = truncate ? "truncate" : "";
  const alignClass = align !== undefined ? alignStyles[align] : "";
  const cls = `${variantBase[variant]} ${colorClass} ${weightClass} ${monoClass} ${truncateClass} ${alignClass}`;
  if (href !== undefined) {
    return (
      <a
        className={`${cls} underline`}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }
  const Element = defaultElements[variant];
  return <Element className={cls}>{children}</Element>;
}
