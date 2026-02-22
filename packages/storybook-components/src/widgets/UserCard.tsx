// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserCardProps {
  name: string;
  role: string;
  status?: "online" | "away" | "offline";
  action?: { label: string; onClick: () => void };
}

// ─── Status dot config ────────────────────────────────────────────────────────

const statusDotClass: Record<NonNullable<UserCardProps["status"]>, string> = {
  online:  "bg-[color:var(--color-success)]",
  away:    "bg-[color:var(--color-warning)]",
  offline: "bg-[color:var(--color-bg-muted)] border border-[color:var(--color-border-strong)]",
};

// ─── Main component ───────────────────────────────────────────────────────────

/** User profile card with avatar, role, status indicator, and optional action. */
export function UserCard({ name, role, status, action }: UserCardProps) {
  const idx = getAvatarIndex(name);

  return (
    <div className="w-56 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-[var(--space-4)]">
      <div className="flex flex-col items-center text-center gap-[var(--space-2)]">
        {/* Avatar with optional status dot */}
        <div className="relative">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[length:var(--text-base)] font-bold font-[family-name:var(--font-sans)] select-none"
            style={{
              backgroundColor: `var(--color-avatar-${String(idx)}-bg)`,
              color: `var(--color-avatar-${String(idx)}-text)`,
            }}
          >
            {getInitials(name)}
          </div>
          {status !== undefined && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[color:var(--color-bg)] ${statusDotClass[status]}`}
            />
          )}
        </div>

        {/* Name */}
        <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[var(--leading-snug)] mt-1">
          {name}
        </p>

        {/* Role */}
        <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] font-[family-name:var(--font-sans)]">
          {role}
        </p>

        {/* Action button */}
        {action !== undefined && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 w-full text-[length:var(--text-xs)] font-medium font-[family-name:var(--font-sans)] px-[var(--space-3)] py-[0.375rem] rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-subtle)] transition-colors cursor-pointer"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
