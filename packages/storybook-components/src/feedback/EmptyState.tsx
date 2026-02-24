import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
}

/** Centered placeholder for empty views with optional icon and description. */
export function EmptyState({ icon, title, children }: EmptyStateProps) {
  return (
    <div className="py-12 text-center flex flex-col items-center gap-[var(--space-2)]">
      {icon !== undefined && (
        <div className="text-[color:var(--color-text-muted)] text-2xl">
          {icon}
        </div>
      )}
      {title !== undefined && (
        <h3 className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)]">
          {title}
        </h3>
      )}
      {children !== undefined && (
        <div className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)]">
          {children}
        </div>
      )}
    </div>
  );
}
