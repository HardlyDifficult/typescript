import type { ReactNode } from "react";

interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

function isSimpleContent(value: ReactNode): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

/** Invisible content grouper — no background, no border. */
export function Section({
  title,
  description,
  actions,
  footer,
  children,
}: SectionProps) {
  const hasHeader =
    title !== undefined || description !== undefined || actions !== undefined;

  return (
    <div>
      {hasHeader && (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title !== undefined &&
              (isSimpleContent(title) ? (
                <span className="text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)] uppercase tracking-[0.05em]">
                  {title}
                </span>
              ) : (
                title
              ))}
            {description !== undefined &&
              (isSimpleContent(description) ? (
                <p className="mt-0.5 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                  {description}
                </p>
              ) : (
                <div className="mt-0.5">{description}</div>
              ))}
          </div>
          {actions !== undefined && <div className="shrink-0">{actions}</div>}
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
