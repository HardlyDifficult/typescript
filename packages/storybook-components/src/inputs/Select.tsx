interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const base =
  "w-full border border-[color:var(--color-border)] rounded-[var(--radius-md)] bg-[color:var(--color-bg)] text-[color:var(--color-text)] font-[family-name:var(--font-sans)] px-3 py-2 text-sm cursor-pointer transition-colors focus:outline-none focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent-subtle)]";

/** Native select element styled with design tokens. */
export function Select({ options, value, onChange, placeholder }: SelectProps) {
  return (
    <select
      className={base}
      value={value}
      onChange={(e) => { onChange(e.target.value); }}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
