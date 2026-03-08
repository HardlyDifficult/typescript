import type { ReactNode } from "react";

type PageMaxWidth = "sm" | "md" | "lg" | "full";

interface PageProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  maxWidth?: PageMaxWidth;
  children: ReactNode;
}

const maxWidthStyles: Record<PageMaxWidth, string> = {
  sm: "max-w-[640px]",
  md: "max-w-[900px]",
  lg: "max-w-[1200px]",
  full: "max-w-full",
};

function isSimpleContent(value: ReactNode): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

/** Page layout — provides a max-width container with consistent padding and an optional header with title and action bar. */
export function Page({
  title,
  description,
  actions,
  maxWidth = "lg",
  children,
}: PageProps) {
  const hasHeader =
    title !== undefined || description !== undefined || actions !== undefined;

  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)] font-[family-name:var(--font-sans)]">
      <main className={`mx-auto px-6 py-5 ${maxWidthStyles[maxWidth]}`}>
        {hasHeader && (
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {title !== undefined &&
                (isSimpleContent(title) ? (
                  <h1 className="text-[length:var(--text-2xl)] font-semibold">
                    {title}
                  </h1>
                ) : (
                  title
                ))}
              {description !== undefined &&
                (isSimpleContent(description) ? (
                  <p className="mt-1 text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
                    {description}
                  </p>
                ) : (
                  <div className="mt-1">{description}</div>
                ))}
            </div>
            {actions !== undefined && (
              <div className="flex shrink-0 items-center gap-3">{actions}</div>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
