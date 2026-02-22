import type { MouseEventHandler, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center font-medium font-[family-name:var(--font-sans)] rounded-[var(--radius-md)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)] shadow-[var(--shadow-sm)]",
  secondary:
    "bg-white text-[color:var(--color-text)] border border-[color:var(--color-border)] hover:bg-[color:var(--color-bg-subtle)] shadow-[var(--shadow-sm)]",
  ghost:
    "bg-transparent text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-muted)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-[length:var(--text-sm)] px-[var(--space-3)] py-[var(--space-1)] gap-[var(--space-1)]",
  md: "text-[length:var(--text-sm)] px-[var(--space-4)] py-[var(--space-2)] gap-[var(--space-2)]",
};

/** Button with primary, secondary, and ghost variants. */
export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  className = "",
  children,
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
