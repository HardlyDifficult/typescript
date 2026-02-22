import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
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
  if (seconds < 60) {return "just now";}
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {return `${String(minutes)}m ago`;}
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {return `${String(hours)}h ago`;}
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
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const idx = getAvatarIndex(name);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[length:var(--text-xs)] font-semibold font-[family-name:var(--font-sans)] flex-shrink-0 select-none"
      style={{
        backgroundColor: `var(--color-avatar-${String(idx)}-bg)`,
        color: `var(--color-avatar-${String(idx)}-text)`,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function EventRow({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const badgeVariant = event.status === "pending" ? "default" : event.status;
  return (
    <div className="relative flex items-start gap-[var(--space-3)] py-[var(--space-3)]">
      {event.actor && !isLast && (
        <span
          className="absolute left-4 top-11 bottom-0 w-px bg-[color:var(--color-border)]"
          aria-hidden="true"
        />
      )}
      {event.actor && (
        <Avatar name={event.actor.name} avatar={event.actor.avatar} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-[var(--space-2)] flex-wrap">
          <span className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[var(--leading-snug)] flex-1 min-w-0">
            {event.message}
          </span>
          <Badge variant={badgeVariant}>{statusLabels[event.status]}</Badge>
        </div>
        <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-1)]">
          {event.actor && (
            <Text variant="caption">{event.actor.name}</Text>
          )}
          <Text variant="caption">{formatRelativeTime(event.timestamp)}</Text>
        </div>
        {event.detail !== undefined && (
          <div className="mt-[var(--space-1)]">
            <Text variant="caption">{event.detail}</Text>
          </div>
        )}
      </div>
    </div>
  );
}

/** Chronological list of events with status badges and actor avatars. */
export function ActivityFeed({
  events,
  title = "Recent Activity",
}: ActivityFeedProps) {
  return (
    <Card>
      <div className="w-80">
        <Text variant="subheading">{title}</Text>
        <div className="mt-[var(--space-4)]">
          {events.map((event, index) => (
            <EventRow key={event.id} event={event} isLast={index === events.length - 1} />
          ))}
        </div>
        {events.length === 0 && (
          <div className="flex flex-col items-center py-[var(--space-8)] gap-[var(--space-2)]">
            <span className="text-2xl select-none" aria-hidden="true">–</span>
            <Text variant="caption">No activity yet</Text>
          </div>
        )}
      </div>
    </Card>
  );
}
