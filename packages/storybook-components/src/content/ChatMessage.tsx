type ChatMessageVariant = "user" | "bot";

interface ChatMessageProps {
  content: string;
  timestamp: string;
  variant: ChatMessageVariant;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {return "just now";}
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {return `${String(minutes)}m ago`;}
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {return `${String(hours)}h ago`;}
  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

const variantStyles: Record<ChatMessageVariant, { row: string; bubble: string; indicator: string }> = {
  user: {
    row: "flex-row-reverse",
    bubble:
      "bg-[color:var(--color-accent-subtle)] border-[color:var(--color-accent-border)] text-[color:var(--color-text)]",
    indicator: "bg-[color:var(--color-accent)]",
  },
  bot: {
    row: "flex-row",
    bubble:
      "bg-[color:var(--color-bg-muted)] border-[color:var(--color-border)] text-[color:var(--color-text)]",
    indicator: "bg-[color:var(--color-text-muted)]",
  },
};

/** Chat message row. User messages align right with accent color; bot messages align left and muted. */
export function ChatMessage({ content, timestamp, variant }: ChatMessageProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`flex ${styles.row} items-start gap-[var(--space-2)] py-[var(--space-1)]`}>
      {/* Indicator dot */}
      <div
        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${styles.indicator}`}
      />
      {/* Message bubble */}
      <div className="max-w-[80%] flex flex-col gap-[var(--space-1)]">
        <div
          className={`rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] font-[family-name:var(--font-sans)] leading-[var(--leading-normal)] whitespace-pre-wrap ${styles.bubble}`}
        >
          {content}
        </div>
        <span
          className={`text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)] ${variant === "user" ? "text-right" : "text-left"}`}
        >
          {formatRelativeTime(timestamp)}
        </span>
      </div>
    </div>
  );
}
