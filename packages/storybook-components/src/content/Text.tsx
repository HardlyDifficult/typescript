import type { ReactNode } from "react";

type TextVariant = "heading" | "subheading" | "body" | "caption" | "code";
type TextColor = "default" | "secondary" | "muted" | "success" | "error" | "info" | "accent";
type TextWeight = "normal" | "medium" | "semibold" | "bold";
type TextAlign = "left" | "center" | "right";

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: TextWeight;
  mono?: boolean;
  truncate?: boolean;
  align?: TextAlign;
  href?: string;
  external?: boolean;
  children: ReactNode;
}

/** Layout/sizing classes per variant — no text color here (color prop handles it separately). */
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

/** Default text color per variant (used when no `color` prop is provided). */
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

const weightStyles: Record<TextWeight, string> = {
  normal:   "font-normal",
  medium:   "font-medium",
  semibold: "font-semibold",
  bold:     "font-bold",
};

const alignStyles: Record<TextAlign, string> = {
  left:   "text-left",
  center: "text-center",
  right:  "text-right",
};

/** Typography primitive with heading, body, caption, and code variants. When `href` is set, renders as an anchor. */
export function Text({ variant = "body", color, weight, mono, truncate, align, href, external, children }: TextProps) {
  if (href !== undefined) {
    return (
      <a
        href={href}
        className="text-[color:var(--color-accent)] no-underline hover:underline font-[family-name:var(--font-sans)] text-sm"
        {...(external === true ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }

  const Element = defaultElements[variant];
  const classes = [variantBase[variant]];

  // Color prop wins over variant default color — only one text-color class applied.
  classes.push(color !== undefined ? colorStyles[color] : variantDefaultColor[variant]);

  if (weight !== undefined) {classes.push(weightStyles[weight]);}
  if (mono === true) {classes.push("font-[family-name:var(--font-mono)]");}
  if (truncate === true) {classes.push("overflow-hidden text-ellipsis whitespace-nowrap");}
  if (align !== undefined) {classes.push(alignStyles[align]);}

  return <Element className={classes.join(" ")}>{children}</Element>;
}
