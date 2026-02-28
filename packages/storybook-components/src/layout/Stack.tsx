import type { ReactNode } from "react";

type StackDirection = "vertical" | "horizontal";
type StackGap = "xs" | "sm" | "md" | "lg";
type StackAlign = "start" | "center" | "end" | "baseline" | "stretch";

interface StackProps {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  wrap?: boolean;
  /** When set, renders as a CSS grid with the given number of columns */
  columns?: number;
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

const gridColsStyles: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

/** Flex layout primitive for vertical and horizontal stacking. Use `columns` for a CSS grid layout. */
export function Stack({ direction = "vertical", gap = "md", align = "stretch", wrap = false, columns, children }: StackProps) {
  if (columns !== undefined) {
    const colClass = gridColsStyles[columns] ?? `grid-cols-${String(columns)}`;
    return (
      <div className={`grid ${colClass} ${gapStyles[gap]}`}>
        {children}
      </div>
    );
  }
  const dir = direction === "vertical" ? "flex-col" : "flex-row";
  const classes = [`flex ${dir} ${gapStyles[gap]} ${alignStyles[align]}`];
  if (wrap) { classes.push("flex-wrap"); }
  return (
    <div className={classes.join(" ")}>
      {children}
    </div>
  );
}
