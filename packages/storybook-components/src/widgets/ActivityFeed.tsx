import type { ReactNode } from "react";

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

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<
  ActivityEvent["status"],
  { label: string; iconBg: string; iconColor: string; badgeBg: string; badgeText: string; accent: string }
> = {
  success: {
    label: "Success",
    iconBg:    "var(--color-success-subtle)",
    iconColor: "var(--color-success)",
    badgeBg:   "var(--color-success-subtle)",
    badgeText: "var(--color-success-dark)",
    accent:    "var(--color-success)",
  },
  error: {
    label: "Failed",
    iconBg:    "var(--color-error-subtle)",
    iconColor: "var(--color-error)",
    badgeBg:   "var(--color-error-subtle)",
    badgeText: "var(--color-error-dark)",
    accent:    "var(--color-error)",
  },
  warning: {
    label: "Warning",
    iconBg:    "var(--color-warning-subtle)",
    iconColor: "var(--color-warning)",
    badgeBg:   "var(--color-warning-subtle)",
    badgeText: "var(--color-warning-dark)",
    accent:    "var(--color-warning)",
  },
  info: {
    label: "Info",
    iconBg:    "var(--color-info-subtle)",
    iconColor: "var(--color-info)",
    badgeBg:   "var(--color-info-subtle)",
    badgeText: "var(--color-info-dark)",
    accent:    "var(--color-info)",
  },
  pending: {
    label: "Pending",
    iconBg:    "var(--color-bg-muted)",
    iconColor: "var(--color-text-muted)",
    badgeBg:   "var(--color-bg-muted)",
    badgeText: "var(--color-text-secondary)",
    accent:    "var(--color-border-strong)",
  },
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSuccess() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconError() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5L12.5 11.5H1.5L7 2.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M7 6V8.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="7" cy="10.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 6.5V10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="7" cy="4.5" r="0.875" fill="currentColor" />
    </svg>
  );
}

function IconPending() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 4V7.5L9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const statusIcons: Record<ActivityEvent["status"], ReactNode> = {
  success: <IconSuccess />,
  error:   <IconError />,
  warning: <IconWarning />,
  info:    <IconInfo />,
  pending: <IconPending />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  {return "just now";}
  const m = Math.floor(s / 60);
  if (m < 60)  {return `${String(m)}m ago`;}
  const h = Math.floor(m / 60);
  if (h < 24)  {return `${String(h)}h ago`;}
  return `${String(Math.floor(h / 24))}d ago`;
}

function getAvatarIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 6;
}

function getInitials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar !== undefined) {
    return (
      <img
        src={avatar}
        alt={name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-[color:var(--color-bg)]"
      />
    );
  }
  const idx = getAvatarIndex(name);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[length:var(--text-xs)] font-bold font-[family-name:var(--font-sans)] flex-shrink-0 select-none ring-2 ring-[color:var(--color-bg)]"
      style={{
        backgroundColor: `var(--color-avatar-${String(idx)}-bg)`,
        color: `var(--color-avatar-${String(idx)}-text)`,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function StatusIcon({ status }: { status: ActivityEvent["status"] }) {
  const cfg = statusConfig[status];
  const isPending = status === "pending";
  return (
    <div className="relative flex-shrink-0">
      {isPending && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-40"
          style={{ backgroundColor: cfg.iconColor }}
        />
      )}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative"
        style={{ backgroundColor: cfg.iconBg, color: cfg.iconColor }}
      >
        {statusIcons[status]}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ActivityEvent["status"] }) {
  const cfg = statusConfig[status];
  return (
    <span
      className="inline-flex items-center px-[0.4rem] py-[0.15rem] rounded-full text-[length:var(--text-xs)] font-semibold font-[family-name:var(--font-sans)] leading-none tracking-wide"
      style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeText }}
    >
      {cfg.label}
    </span>
  );
}

function EventRow({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const cfg = statusConfig[event.status];
  return (
    <div className="relative group">
      {/* Connector line */}
      {!isLast && (
        <span
          className="absolute left-4 top-10 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, var(--color-border-strong) 0%, var(--color-border) 60%, transparent 100%)" }}
          aria-hidden="true"
        />
      )}

      <div
        className="relative flex items-start gap-[var(--space-3)] py-[var(--space-2-5,0.625rem)] pl-[var(--space-3)] pr-[var(--space-3)] rounded-[var(--radius-md)] transition-all duration-150 hover:bg-[color:var(--color-bg-subtle)] hover:shadow-[var(--shadow-sm)]"
      >
        {/* Left accent bar — visible on hover */}
        <span
          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ backgroundColor: cfg.accent }}
          aria-hidden="true"
        />

        {/* Icon: actor avatar if present, else status icon */}
        {event.actor !== undefined ? (
          <div className="relative">
            <Avatar name={event.actor.name} avatar={event.actor.avatar} />
            {/* Status icon badge overlaid bottom-right */}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[color:var(--color-bg)]"
              style={{ backgroundColor: cfg.iconBg, color: cfg.iconColor }}
            >
              <div className="scale-[0.7]">{statusIcons[event.status]}</div>
            </div>
          </div>
        ) : (
          <StatusIcon status={event.status} />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          {/* Message line */}
          <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[var(--leading-snug)]">
            {event.message}
          </p>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-x-[var(--space-2)] gap-y-1 mt-1">
            {event.actor !== undefined && (
              <span className="text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)]">
                {event.actor.name}
              </span>
            )}
            <StatusBadge status={event.status} />
            {event.detail !== undefined && (
              <span className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)]">
                {event.detail}
              </span>
            )}
          </div>
        </div>

        {/* Timestamp — top-right */}
        <time
          dateTime={event.timestamp.toISOString()}
          title={event.timestamp.toLocaleString()}
          className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)] flex-shrink-0 tabular-nums pt-0.5"
        >
          {formatRelativeTime(event.timestamp)}
        </time>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-[var(--space-10,2.5rem)] gap-[var(--space-3)] text-center">
      {/* Stacked paper illustration */}
      <div className="relative w-12 h-12 mb-1">
        <div
          className="absolute inset-0 rounded-[var(--radius-md)] rotate-6 opacity-30"
          style={{ backgroundColor: "var(--color-accent-subtle)", border: "1.5px solid var(--color-accent-border)" }}
        />
        <div
          className="absolute inset-0 rounded-[var(--radius-md)] -rotate-3 opacity-50"
          style={{ backgroundColor: "var(--color-accent-subtle)", border: "1.5px solid var(--color-accent-border)" }}
        />
        <div
          className="absolute inset-0 rounded-[var(--radius-md)] flex items-center justify-center"
          style={{ backgroundColor: "var(--color-accent-subtle)", border: "1.5px solid var(--color-accent-border)", color: "var(--color-accent)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 4V10M10 10L7 8M10 10L13 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 14h12M4 17h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)]">
        Nothing here yet
      </p>
      <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)] max-w-[14rem] leading-[var(--leading-relaxed)]">
        Events will show up here as your team gets things done.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/** Chronological list of events with status indicators and actor avatars. */
export function ActivityFeed({
  events,
  title = "Recent Activity",
}: ActivityFeedProps) {
  return (
    <div className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-96 overflow-hidden">
      {/* Header */}
      <div
        className="px-[var(--space-4)] pt-[var(--space-4)] pb-[var(--space-3)] flex items-center justify-between border-b border-[color:var(--color-border)]"
        style={{ background: "linear-gradient(to bottom, var(--color-bg-subtle), var(--color-bg))" }}
      >
        <p className="text-[length:var(--text-xs)] font-bold text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)] uppercase tracking-[0.08em] leading-none">
          {title}
        </p>
        {events.length > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[length:var(--text-xs)] font-bold font-[family-name:var(--font-mono)] leading-none tabular-nums"
            style={{ backgroundColor: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
          >
            {events.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-[var(--space-2)] py-[var(--space-2)]">
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
    </div>
  );
}
