import type { ReactNode } from "react";

type StackDirection = "vertical" | "horizontal";
type StackGap = "xs" | "sm" | "md" | "lg";
type StackAlign = "start" | "center" | "end" | "baseline" | "stretch";

interface StackProps {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  wrap?: boolean;
  children: ReactNode;
}

const gapStyles: Record<StackGap, string> = {
  xs: "gap-[var(--space-1)]",
  sm: "gap-[var(--space-2)]",
  md: "gap-[var(--space-4)]",
  lg: "gap-[var(--space-6)]",
};

const alignStyles: Record<StackAlign, string> = {
  start:    "items-start",
  center:   "items-center",
  end:      "items-end",
  baseline: "items-baseline",
  stretch:  "items-stretch",
};

/** Flex layout primitive for vertical and horizontal stacking. */
export function Stack({ direction = "vertical", gap = "md", align = "stretch", wrap = false, children }: StackProps) {
  const dir = direction === "vertical" ? "flex-col" : "flex-row";
  const classes = [`flex ${dir} ${gapStyles[gap]} ${alignStyles[align]}`];
  if (wrap) { classes.push("flex-wrap"); }
  return (
    <div className={classes.join(" ")}>
      {children}
    </div>
  );
}
