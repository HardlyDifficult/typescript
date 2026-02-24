import type { ReactNode } from "react";

type PageMaxWidth = "sm" | "md" | "lg" | "full";

interface PageProps {
  title: string;
  headerActions?: ReactNode;
  maxWidth?: PageMaxWidth;
  children: ReactNode;
}

const maxWidthStyles: Record<PageMaxWidth, string> = {
  sm: "max-w-[640px]",
  md: "max-w-[900px]",
  lg: "max-w-[1200px]",
  full: "max-w-full",
};

/** Page layout — title is shown in the global nav, not repeated inline. */
export function Page({ title: _title, headerActions, maxWidth = "lg", children }: PageProps) {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)] font-[family-name:var(--font-sans)]">
      <main className={`mx-auto px-6 py-5 ${maxWidthStyles[maxWidth]}`}>
        {headerActions !== undefined && (
          <div className="flex items-center justify-end mb-5">
            <div className="flex items-center gap-3">{headerActions}</div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
