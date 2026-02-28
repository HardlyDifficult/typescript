import type { MouseEventHandler, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center font-medium font-[family-name:var(--font-sans)] rounded-[var(--radius-md)] border border-transparent transition-all duration-200 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.985]";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-[color:var(--color-accent)] to-[color:var(--color-accent-hover)] text-white hover:brightness-105 shadow-[var(--shadow-accent)]",
  secondary:
    "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent)] border-[color:var(--color-accent)] hover:brightness-95 shadow-[var(--shadow-sm)]",
  ghost:
    "bg-transparent text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-text)]",
  danger:
    "bg-[color:var(--color-error)] text-white hover:bg-[color:var(--color-error-dark)] shadow-[0_0_0_1px_rgba(220,38,38,0.15),0_2px_8px_rgba(220,38,38,0.25)]",
  link:
    "bg-transparent text-[color:var(--color-accent)] hover:underline border-none shadow-none p-0",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-[length:var(--text-xs)] px-[var(--space-2)] py-px gap-[var(--space-1)]",
  md: "text-[length:var(--text-sm)] px-[var(--space-3)] py-[0.375rem] gap-[var(--space-2)]",
};

/** Button with primary, secondary, ghost, danger, and link variants. */
export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  type = "button",
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={[base, variantStyles[variant], sizeStyles[size], fullWidth ? "w-full" : ""].join(" ")}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
    >
      {loading && <span className="animate-pulse">...</span>}
      {children}
    </button>
  );
}
