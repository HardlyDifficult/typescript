import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/** Container with border, shadow, and hover lift. */
export function Card({ title, footer, children }: CardProps) {
  const hasSection = title !== undefined || footer !== undefined;
  return (
    <div className={`bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]${hasSection ? "" : " p-[var(--space-6)]"}`}>
      {title !== undefined && (
        <div className="px-[var(--space-6)] pt-[var(--space-6)] pb-[var(--space-4)] border-b border-[color:var(--color-border)]">
          <span className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)] uppercase tracking-[0.06em]">
            {title}
          </span>
        </div>
      )}
      <div className={hasSection ? "p-[var(--space-6)]" : undefined}>
        {children}
      </div>
      {footer !== undefined && (
        <div className="px-[var(--space-6)] py-[var(--space-2)] border-t border-[color:var(--color-border)]">
          {footer}
        </div>
      )}
    </div>
  );
}
