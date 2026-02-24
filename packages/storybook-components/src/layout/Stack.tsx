import type { ReactNode } from "react";

type StackDirection = "vertical" | "horizontal";
type StackGap = "xs" | "sm" | "md" | "lg";
type StackAlign = "start" | "center" | "end" | "baseline" | "stretch";
type StackColumns = 1 | 2 | 3 | 4;

interface StackProps {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  wrap?: boolean;
  columns?: StackColumns;
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

const columnStyles: Record<StackColumns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

/** Flex layout primitive for vertical and horizontal stacking. When `columns` is set, renders CSS grid instead. */
export function Stack({ direction = "vertical", gap = "md", align = "stretch", wrap = false, columns, children }: StackProps) {
  if (columns !== undefined) {
    return (
      <div className={`grid ${columnStyles[columns]} ${gapStyles[gap]}`}>
        {children}
      </div>
    );
  }

  const dir = direction === "vertical" ? "flex-col" : "flex-row";
  const classes = [`flex ${dir} ${gapStyles[gap]} ${alignStyles[align]}`];
  if (wrap) {classes.push("flex-wrap");}
  return (
    <div className={classes.join(" ")}>
      {children}
    </div>
  );
}
