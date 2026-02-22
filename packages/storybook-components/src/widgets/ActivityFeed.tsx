import { Text } from "../components/Text.js";

export interface ActivityEvent {
  id: string;
  message: string;
  timestamp: Date;
  status: "success" | "error" | "warning" | "info" | "pending";
  actor?: { name: string; avatar?: string };
  detail?: string;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  title?: string;
}

const statusColors: Record<ActivityEvent["status"], string> = {
  success: "var(--color-success)",
  error:   "var(--color-error)",
  warning: "var(--color-warning)",
  info:    "var(--color-info)",
  pending: "var(--color-text-muted)",
};

const statusLabels: Record<ActivityEvent["status"], string> = {
  success: "Success",
  error:   "Error",
  warning: "Warning",
  info:    "Info",
  pending: "Pending",
};

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) { return "just now"; }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) { return `${String(minutes)}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${String(hours)}h ago`; }
  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 6;
}

function Avatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar !== undefined) {
    return (
      <img
        src={avatar}
        alt={name}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-2 ring-[color:var(--color-bg)]"
      />
    );
  }
  const idx = getAvatarIndex(name);
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[length:var(--text-xs)] font-semibold font-[family-name:var(--font-sans)] flex-shrink-0 select-none ring-2 ring-[color:var(--color-bg)]"
      style={{
        backgroundColor: `var(--color-avatar-${String(idx)}-bg)`,
        color: `var(--color-avatar-${String(idx)}-text)`,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function StatusDot({ status }: { status: ActivityEvent["status"] }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: statusColors[status] }}
      aria-hidden="true"
    />
  );
}

function EventRow({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  return (
    <div className="relative flex items-start gap-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-sm)] -mx-[var(--space-2)] px-[var(--space-2)] transition-colors duration-100 hover:bg-[color:var(--color-bg-subtle)]">
      {/* Connector line between rows — gradient fade for a polished look */}
      {!isLast && (
        <span
          className="absolute left-3.5 top-9 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, var(--color-border-strong), var(--color-border), transparent)" }}
          aria-hidden="true"
        />
      )}

      {/* Avatar or placeholder dot */}
      {event.actor !== undefined ? (
        <Avatar name={event.actor.name} avatar={event.actor.avatar} />
      ) : (
        <span
          className="w-7 h-7 flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColors[event.status] }}
          />
        </span>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Message + timestamp on one line */}
        <div className="flex items-baseline justify-between gap-[var(--space-2)]">
          <span className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[var(--leading-snug)] flex-1 min-w-0 truncate">
            {event.message}
          </span>
          <time
            dateTime={event.timestamp.toISOString()}
            title={event.timestamp.toLocaleString()}
            className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)] flex-shrink-0 tabular-nums whitespace-nowrap"
          >
            {formatRelativeTime(event.timestamp)}
          </time>
        </div>

        {/* Actor · status · detail */}
        <div className="flex items-center gap-[var(--space-1-5,0.375rem)] mt-0.5 flex-wrap">
          {event.actor !== undefined && (
            <span className="text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)]">
              {event.actor.name}
            </span>
          )}
          <StatusDot status={event.status} />
          <span className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)]">
            {statusLabels[event.status]}
          </span>
          {event.detail !== undefined && (
            <>
              <span className="text-[color:var(--color-border-strong)] select-none" aria-hidden="true">·</span>
              <span className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)] truncate">
                {event.detail}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-[var(--space-8)] gap-[var(--space-2)]">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        className="text-[color:var(--color-text-muted)]"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 4V2M16 4V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 14h4M8 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <Text variant="caption">No activity yet</Text>
    </div>
  );
}

/** Chronological list of events with status indicators and actor avatars. */
export function ActivityFeed({
  events,
  title = "Recent Activity",
}: ActivityFeedProps) {
  return (
    <div
      className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-[var(--space-5)] w-80"
    >
      <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)] uppercase tracking-[0.06em] leading-none mb-[var(--space-3)]">
        {title}
      </p>
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {events.map((event, index) => (
            <EventRow key={event.id} event={event} isLast={index === events.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
