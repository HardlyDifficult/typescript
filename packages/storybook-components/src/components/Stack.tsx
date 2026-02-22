import type { ReactNode } from "react";

type StackDirection = "vertical" | "horizontal";
type StackGap = "sm" | "md" | "lg";
type StackAlign = "start" | "center" | "end" | "stretch";

interface StackProps {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  className?: string;
  children: ReactNode;
}

const gapStyles: Record<StackGap, string> = {
  sm: "gap-[var(--space-2)]",
  md: "gap-[var(--space-4)]",
  lg: "gap-[var(--space-6)]",
};

const alignStyles: Record<StackAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

/** Flex layout primitive for vertical and horizontal stacking. */
export function Stack({
  direction = "vertical",
  gap = "md",
  align = "stretch",
  className = "",
  children,
}: StackProps) {
  const dir = direction === "vertical" ? "flex-col" : "flex-row";
  return (
    <div
      className={`flex ${dir} ${gapStyles[gap]} ${alignStyles[align]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
