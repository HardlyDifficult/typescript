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

/** Page layout — title is inline content, no separate header bar. */
export function Page({ title, headerActions, maxWidth = "lg", children }: PageProps) {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)] font-[family-name:var(--font-sans)]">
      <main className={`mx-auto px-6 py-5 ${maxWidthStyles[maxWidth]}`}>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-secondary)]">{title}</h1>
          {headerActions !== undefined && <div className="flex items-center gap-3">{headerActions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
