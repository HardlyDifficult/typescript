import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "accent" | "muted";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  children?: ReactNode;
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-[var(--space-1)] py-0 text-[length:0.65rem]",
  md: "px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-xs)]",
};

const dotSizeStyles: Record<BadgeSize, string> = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
};

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string; border: string }> = {
  default: {
    bg:     "bg-[color:var(--color-bg-muted)]",
    text:   "text-[color:var(--color-text-secondary)]",
    dot:    "bg-[color:var(--color-text-muted)]",
    border: "border-[color:var(--color-border)]",
  },
  success: {
    bg:     "bg-[color:var(--color-success-subtle)]",
    text:   "text-[color:var(--color-success)]",
    dot:    "bg-[color:var(--color-success)]",
    border: "border-[color:var(--color-success-border)]",
  },
  warning: {
    bg:     "bg-[color:var(--color-warning-subtle)]",
    text:   "text-[color:var(--color-warning)]",
    dot:    "bg-[color:var(--color-warning)]",
    border: "border-[color:var(--color-warning-border)]",
  },
  error: {
    bg:     "bg-[color:var(--color-error-subtle)]",
    text:   "text-[color:var(--color-error)]",
    dot:    "bg-[color:var(--color-error)]",
    border: "border-[color:var(--color-error-border)]",
  },
  info: {
    bg:     "bg-[color:var(--color-info-subtle)]",
    text:   "text-[color:var(--color-info)]",
    dot:    "bg-[color:var(--color-info)]",
    border: "border-[color:var(--color-info-border)]",
  },
  accent: {
    bg:     "bg-[color:var(--color-accent-subtle)]",
    text:   "text-[color:var(--color-accent)]",
    dot:    "bg-[color:var(--color-accent)]",
    border: "border-[color:var(--color-accent-border)]",
  },
  muted: {
    bg:     "bg-[color:var(--color-bg-muted)]",
    text:   "text-[color:var(--color-text-muted)]",
    dot:    "bg-[color:var(--color-text-muted)]",
    border: "border-[color:var(--color-border)]",
  },
};

/** Semantic status badge with colored dot indicator. Use `dot` for standalone dot mode (no label). */
export function Badge({ variant = "default", size = "md", dot = false, pulse = false, children }: BadgeProps) {
  const styles = variantStyles[variant];

  // Dot-only mode: render just the circle
  if (dot && children === undefined) {
    return (
      <span
        className={`inline-block rounded-full ${dotSizeStyles[size]} ${styles.dot}${pulse ? " animate-pulse" : ""}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-full)] font-medium font-[family-name:var(--font-sans)] border ${sizeStyles[size]} ${styles.bg} ${styles.text} ${styles.border}`}
    >
      <span className={`rounded-full flex-shrink-0 ${dotSizeStyles[size]} ${styles.dot}${pulse ? " animate-pulse" : ""}`} />
      {children}
    </span>
  );
}
