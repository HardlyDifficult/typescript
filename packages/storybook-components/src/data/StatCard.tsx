interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  caption?: string;
}

function IconTrendUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 9V3M6 3L3 6M6 3L9 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrendDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 3V9M6 9L3 6M6 9L9 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Metric tile showing a key value with optional trend indicator. */
export function StatCard({ label, value, trend, caption }: StatCardProps) {
  return (
    <div className="w-56 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-5">
      <p className="text-[length:var(--text-xs)] font-bold uppercase tracking-[0.08em] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)]">
        {label}
      </p>
      <p className="text-[length:var(--text-2xl)] font-bold text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[var(--leading-tight)] tracking-[var(--tracking-tighter)] mt-1">
        {value}
      </p>
      {trend !== undefined && (
        <div className="mt-2">
          {trend > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[length:var(--text-xs)] font-semibold font-[family-name:var(--font-sans)] px-2 py-0.5 rounded-[var(--radius-full)] bg-[color:var(--color-success-subtle)] text-[color:var(--color-success)]">
              <IconTrendUp />
              +{trend}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[length:var(--text-xs)] font-semibold font-[family-name:var(--font-sans)] px-2 py-0.5 rounded-[var(--radius-full)] bg-[color:var(--color-error-subtle)] text-[color:var(--color-error)]">
              <IconTrendDown />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
      {caption !== undefined && (
        <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)] mt-1">
          {caption}
        </p>
      )}
    </div>
  );
}
