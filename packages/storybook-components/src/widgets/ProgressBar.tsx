interface ProgressBarProps {
  value: number;
  label?: string;
}

/** Linear progress bar with percentage display. */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const fillColor =
    clamped === 100
      ? "bg-[color:var(--color-success)]"
      : "bg-[color:var(--color-accent)]";

  return (
    <div className="w-72">
      {label !== undefined && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)]">
            {label}
          </span>
          <span className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text)] font-[family-name:var(--font-mono)] tabular-nums">
            {clamped}%
          </span>
        </div>
      )}
      {label === undefined && (
        <div className="flex justify-end mb-2">
          <span className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text)] font-[family-name:var(--font-mono)] tabular-nums">
            {clamped}%
          </span>
        </div>
      )}
      <div className="h-2 rounded-[var(--radius-full)] bg-[color:var(--color-bg-muted)] overflow-hidden">
        <div
          className={`h-full rounded-[var(--radius-full)] transition-all duration-500 ease-out ${fillColor}`}
          style={{ width: `${clamped.toString()}%` }}
        />
      </div>
    </div>
  );
}
