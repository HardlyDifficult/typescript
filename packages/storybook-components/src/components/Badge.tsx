import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  default: {
    bg: "bg-[color:var(--color-bg-muted)]",
    text: "text-[color:var(--color-text-secondary)]",
    dot: "bg-[color:var(--color-text-muted)]",
  },
  success: {
    bg: "bg-[color:var(--color-success-subtle)]",
    text: "text-[color:var(--color-success)]",
    dot: "bg-[color:var(--color-success)]",
  },
  warning: {
    bg: "bg-[color:var(--color-warning-subtle)]",
    text: "text-[color:var(--color-warning)]",
    dot: "bg-[color:var(--color-warning)]",
  },
  error: {
    bg: "bg-[color:var(--color-error-subtle)]",
    text: "text-[color:var(--color-error)]",
    dot: "bg-[color:var(--color-error)]",
  },
  info: {
    bg: "bg-[color:var(--color-info-subtle)]",
    text: "text-[color:var(--color-info)]",
    dot: "bg-[color:var(--color-info)]",
  },
};

export function Badge({ variant = "default", className = "", children }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <span
      className={`inline-flex items-center gap-[var(--space-1)] px-[var(--space-2)] py-0.5 rounded-[var(--radius-full)] text-[length:var(--text-xs)] font-medium font-[family-name:var(--font-sans)] ${styles.bg} ${styles.text} ${className}`.trim()}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {children}
    </span>
  );
}
