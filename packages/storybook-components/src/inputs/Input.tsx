type InputSize = "sm" | "md";

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: InputSize;
  type?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
}

const base =
  "w-full border border-[color:var(--color-border)] rounded-[var(--radius-md)] bg-[color:var(--color-bg)] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] transition-colors focus:outline-none focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent-subtle)]";

const sizeStyles: Record<InputSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
};

/** Text input. Set `multiline` for a textarea. */
export function Input({
  value,
  onChange,
  placeholder,
  size = "md",
  type = "text",
  multiline = false,
  rows = 4,
  mono = false,
}: InputProps) {
  const font = mono
    ? "font-[family-name:var(--font-mono)]"
    : "font-[family-name:var(--font-sans)]";
  const cls = `${base} ${sizeStyles[size]} ${font}`;

  if (multiline) {
    return (
      <textarea
        className={`${cls} resize-y`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        rows={rows}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      className={cls}
      type={type}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={placeholder}
    />
  );
}
