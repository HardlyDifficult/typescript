import type { MouseEventHandler, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center font-medium font-[family-name:var(--font-sans)] rounded-[var(--radius-md)] transition-all cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)] shadow-[var(--shadow-accent)]",
  secondary:
    "bg-[color:var(--color-bg)] text-[color:var(--color-text)] border border-[color:var(--color-border)] hover:bg-[color:var(--color-bg-subtle)] hover:border-[color:var(--color-border-strong)] shadow-[var(--shadow-sm)]",
  ghost:
    "bg-transparent text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-text)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-[length:var(--text-sm)] px-[var(--space-3)] py-[var(--space-2)] gap-[var(--space-1)]",
  md: "text-[length:var(--text-sm)] px-[var(--space-5)] py-[var(--space-2)] gap-[var(--space-2)]",
};

/** Button with primary, secondary, and ghost variants. */
export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  icon,
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variantStyles[variant]} ${sizeStyles[size]}`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon !== undefined && icon}{children}
    </button>
  );
}
