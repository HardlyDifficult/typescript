import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
}

/** Container with border, shadow, and hover lift. */
export function Card({ children }: CardProps) {
  return (
    <div className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)] p-[var(--space-6)]">
      {children}
    </div>
  );
}
