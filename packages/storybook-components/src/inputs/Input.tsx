import type { KeyboardEvent } from "react";
import type React from "react";

type InputSize = "sm" | "md";

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  placeholder?: string;
  size?: InputSize;
  type?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
}

const base =
  "w-full border border-[color:var(--color-border)] rounded-[var(--radius-md)] bg-[color:var(--color-bg)] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] transition-colors focus:outline-none focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent-subtle)] font-[family-name:var(--font-sans)]";

const sizeStyles: Record<InputSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
};

/** Text input. Set `multiline` for a textarea. */
export function Input({
  value,
  onChange,
  onKeyDown,
  placeholder,
  size = "md",
  type = "text",
  multiline = false,
  rows = 4,
  mono = false,
}: InputProps) {
  const monoClass = mono ? "font-[family-name:var(--font-mono)]" : "";
  const cls = `${base} ${sizeStyles[size]} ${monoClass}`;

  if (multiline) {
    return (
      <textarea
        className={`${cls} resize-y`}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          onChange(e.target.value);
        }}
        onKeyDown={onKeyDown}
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
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      }}
      placeholder={placeholder}
    />
  );
}
