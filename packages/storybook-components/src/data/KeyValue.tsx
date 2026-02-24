import type { ReactNode } from "react";

interface KeyValueProps {
  label: string;
  children: ReactNode;
  direction?: "horizontal" | "vertical";
}

/** Key-value pair display for metadata or detail views. */
export function KeyValue({ label, children, direction = "horizontal" }: KeyValueProps) {
  const isHorizontal = direction === "horizontal";

  return (
    <div
      className={
        isHorizontal
          ? "flex items-baseline gap-[var(--space-2)]"
          : "flex flex-col gap-0.5"
      }
    >
      <dt
        className={`text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)]${isHorizontal ? " flex-shrink-0 w-[120px]" : ""}`}
      >
        {label}
      </dt>
      <dd className="text-[length:var(--text-sm)] text-[color:var(--color-text)] font-[family-name:var(--font-sans)]">
        {children}
      </dd>
    </div>
  );
}
