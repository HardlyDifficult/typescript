import type { ReactNode } from "react";

type StackDirection = "vertical" | "horizontal";
type StackGap = "sm" | "md" | "lg";

interface StackProps {
  direction?: StackDirection;
  gap?: StackGap;
  children: ReactNode;
}

const gapStyles: Record<StackGap, string> = {
  sm: "gap-[var(--space-2)]",
  md: "gap-[var(--space-4)]",
  lg: "gap-[var(--space-6)]",
};

/** Flex layout primitive for vertical and horizontal stacking. */
export function Stack({ direction = "vertical", gap = "md", children }: StackProps) {
  const dir = direction === "vertical" ? "flex-col" : "flex-row";
  return (
    <div className={`flex ${dir} ${gapStyles[gap]} items-stretch`}>
      {children}
    </div>
  );
}
