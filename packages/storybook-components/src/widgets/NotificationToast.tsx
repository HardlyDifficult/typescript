import React from "react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotificationToastProps {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
}

// ─── Status config ────────────────────────────────────────────────────────────

const config: Record<
  NotificationToastProps["variant"],
  { iconBg: string; iconColor: string; accent: string; actionColor: string }
> = {
  success: {
    iconBg:      "var(--color-success-subtle)",
    iconColor:   "var(--color-success)",
    accent:      "var(--color-success)",
    actionColor: "var(--color-success-dark)",
  },
  error: {
    iconBg:      "var(--color-error-subtle)",
    iconColor:   "var(--color-error)",
    accent:      "var(--color-error)",
    actionColor: "var(--color-error-dark)",
  },
  warning: {
    iconBg:      "var(--color-warning-subtle)",
    iconColor:   "var(--color-warning)",
    accent:      "var(--color-warning)",
    actionColor: "var(--color-warning-dark)",
  },
  info: {
    iconBg:      "var(--color-info-subtle)",
    iconColor:   "var(--color-info)",
    accent:      "var(--color-info)",
    actionColor: "var(--color-info-dark)",
  },
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSuccess() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconError() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5L12.5 11.5H1.5L7 2.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M7 6V8.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="7" cy="10.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 6.5V10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="7" cy="4.5" r="0.875" fill="currentColor" />
    </svg>
  );
}

const statusIcons: Record<NotificationToastProps["variant"], React.ReactNode> = {
  success: <IconSuccess />,
  error:   <IconError />,
  warning: <IconWarning />,
  info:    <IconInfo />,
};

// ─── Main component ───────────────────────────────────────────────────────────

/** Dismissable notification toast with status variants. */
export function NotificationToast({
  variant,
  title,
  message,
  onDismiss,
  action,
}: NotificationToastProps) {
  const cfg = config[variant];

  return (
    <div
      className="w-80 bg-[color:var(--color-bg)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden border border-[color:var(--color-border)]"
      style={{ borderLeft: `4px solid ${cfg.accent}` }}
    >
      <div className="relative flex items-start gap-[var(--space-3)] p-[var(--space-4)]">
        {/* Icon area */}
        <div
          className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: cfg.iconBg, color: cfg.iconColor }}
        >
          {statusIcons[variant]}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text)] font-[family-name:var(--font-sans)] leading-[var(--leading-snug)]">
            {title}
          </p>
          {message !== undefined && (
            <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)] font-[family-name:var(--font-sans)] leading-[var(--leading-normal)] mt-0.5">
              {message}
            </p>
          )}
          {action !== undefined && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-2 text-[length:var(--text-xs)] font-semibold font-[family-name:var(--font-sans)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-md)] transition-colors cursor-pointer"
              style={{ color: cfg.actionColor }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = cfg.iconBg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss !== undefined && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute top-3 right-3 w-5 h-5 rounded-[var(--radius-sm)] hover:bg-[color:var(--color-bg-muted)] text-[color:var(--color-text-muted)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
