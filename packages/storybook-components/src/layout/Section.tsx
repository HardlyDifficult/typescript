import type { ReactNode } from "react";

interface SectionProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Invisible content grouper — no background, no border. */
export function Section({ title, subtitle, actions, footer, children }: SectionProps) {
  return (
    <div>
      {title !== undefined && (
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)] uppercase tracking-[0.05em]">
              {title}
            </span>
            {subtitle !== undefined && (
              <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions !== undefined && <div>{actions}</div>}
        </div>
      )}
      <div>{children}</div>
      {footer !== undefined && (
        <div className="pt-3 mt-3 border-t border-[color:var(--color-border)]">
          {footer}
        </div>
      )}
    </div>
  );
}
