"use client";

interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
}

const container =
  "flex gap-0 border-b border-[color:var(--color-border)]";

const baseTab =
  "px-3 py-2 text-xs font-medium cursor-pointer transition-colors -mb-px";

const activeTab =
  "text-[color:var(--color-text)] border-b-2 border-[color:var(--color-text)]";

const inactiveTab =
  "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)] border-b-2 border-transparent";

/** Segmented tab group for switching between views. */
export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className={container}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`${baseTab} ${tab.value === value ? activeTab : inactiveTab}`}
          onClick={() => { onChange(tab.value); }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
