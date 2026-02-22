import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { Stack } from "../components/Stack.js";
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
  className?: string;
}

const statusLabels: Record<ActivityEvent["status"], string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Info",
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

function Avatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar !== undefined) {
    return (
      <img
        src={avatar}
        alt={name}
        className="w-8 h-8 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent)] flex items-center justify-center text-[length:var(--text-xs)] font-medium font-[family-name:var(--font-sans)]">
      {getInitials(name)}
    </div>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const badgeVariant = event.status === "pending" ? "default" : event.status;
  return (
    <div className="flex items-start gap-[var(--space-3)] py-[var(--space-3)]">
      {event.actor && (
        <Avatar name={event.actor.name} avatar={event.actor.avatar} />
      )}
      <div className="flex-1 min-w-0">
        <Stack direction="horizontal" gap="sm" align="center">
          <Text variant="body" className="!text-[length:var(--text-sm)] !text-[color:var(--color-text)] truncate">
            {event.message}
          </Text>
          <Badge variant={badgeVariant}>{statusLabels[event.status]}</Badge>
        </Stack>
        <Stack direction="horizontal" gap="sm" align="center">
          {event.actor && (
            <Text variant="caption">{event.actor.name}</Text>
          )}
          <Text variant="caption">{formatRelativeTime(event.timestamp)}</Text>
        </Stack>
        {event.detail !== undefined && (
          <Text variant="caption" className="mt-[var(--space-1)]">
            {event.detail}
          </Text>
        )}
      </div>
    </div>
  );
}

/** Chronological list of events with status badges and actor avatars. */
export function ActivityFeed({
  events,
  title = "Recent Activity",
  className = "",
}: ActivityFeedProps) {
  return (
    <Card padding="lg" className={`w-96 ${className}`.trim()}>
      <Text variant="subheading" className="mb-[var(--space-4)]">
        {title}
      </Text>
      <div className="divide-y divide-[color:var(--color-border)]">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
      {events.length === 0 && (
        <Text variant="caption" className="text-center py-[var(--space-6)]">
          No activity yet
        </Text>
      )}
    </Card>
  );
}
