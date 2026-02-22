import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

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
};

/** Semantic status badge with colored dot indicator. */
export function Badge({ variant = "default", children }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <span
      className={`inline-flex items-center gap-[var(--space-1)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-full)] text-[length:var(--text-xs)] font-medium font-[family-name:var(--font-sans)] border ${styles.bg} ${styles.text} ${styles.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`} />
      {children}
    </span>
  );
}
