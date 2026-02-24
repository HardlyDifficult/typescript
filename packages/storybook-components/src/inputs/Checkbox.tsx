interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

/** Custom styled checkbox with optional label. */
export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => { onChange(e.target.checked); }}
      />
      <div className={[
        "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-150",
        checked
          ? "bg-[color:var(--color-accent)] border-[color:var(--color-accent)]"
          : "bg-[color:var(--color-bg)] border-[color:var(--color-border-strong)] group-hover:border-[color:var(--color-accent)]",
      ].join(" ")}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {label !== undefined && (
        <span className="text-sm text-[color:var(--color-text)] font-[family-name:var(--font-sans)]">
          {label}
        </span>
      )}
    </label>
  );
}
