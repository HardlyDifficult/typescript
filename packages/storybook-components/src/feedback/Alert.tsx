import type { ReactNode } from "react";

type AlertVariant = "error" | "info" | "warning" | "success";

interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
}

const variantStyles: Record<AlertVariant, string> = {
  error:
    "bg-[color:var(--color-error-subtle)] text-[color:var(--color-error)]",
  info:
    "bg-[color:var(--color-info-subtle)] text-[color:var(--color-info)]",
  warning:
    "bg-[color:var(--color-warning-subtle)] text-[color:var(--color-warning)]",
  success:
    "bg-[color:var(--color-success-subtle)] text-[color:var(--color-success)]",
};

/** Inline status alert with error, info, warning, and success variants. */
export function Alert({ variant = "error", children }: AlertProps) {
  return (
    <div
      className={`mb-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-[family-name:var(--font-sans)] ${variantStyles[variant]}`}
    >
      {children}
    </div>
  );
}
