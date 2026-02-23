'use client';

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface GlobalNavLink {
  href: string;
  label: string;
}

export interface GlobalNavCategory {
  label: string;
  items: GlobalNavLink[];
}

export interface GlobalNavWorkerStatus {
  /** Number of actively running jobs */
  activeJobs: number;
  /** Maximum concurrent job capacity */
  totalCapacity: number;
  /** Number of jobs waiting in queue */
  queuedJobs: number;
  /** Whether the WebSocket connection is live */
  wsConnected: boolean;
  /** Whether any workers are registered */
  hasWorkers: boolean;
}

export interface GlobalNavProps {
  /** Application title shown on the left side */
  title?: string;
  /** Current page path — that nav item is hidden from the dropdown */
  currentPath?: string;
  /** Navigation categories and their links */
  categories: GlobalNavCategory[];
  /** Live worker and job status */
  workerStatus?: GlobalNavWorkerStatus;
  /** Total AI cost in USD — null hides the indicator */
  totalCost?: number | null;
  /** Called when the user clicks Sign out */
  onSignOut?: () => void;
  /**
   * Render a navigation link. Defaults to a plain `<a>` tag.
   * Pass a Next.js `<Link>` or React Router `<Link>` for SPA navigation.
   */
  renderLink?: (props: {
    href: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => ReactNode;
}

function DefaultLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

/** Hamburger / menu icon */
function MenuIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect y="2" width="15" height="1.5" rx="0.75" fill="currentColor" />
      <rect y="6.75" width="15" height="1.5" rx="0.75" fill="currentColor" />
      <rect y="11.5" width="15" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

/**
 * Global navigation bar for the dashboard.
 * Renders a top bar with title, worker status, cost indicator, and a nav dropdown.
 * All styling comes from the design system tokens; consumers provide business logic via props.
 */
export function GlobalNav({
  title,
  currentPath,
  categories,
  workerStatus,
  totalCost,
  onSignOut,
  renderLink,
}: GlobalNavProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = renderLink ?? ((p) => <DefaultLink {...p} />);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const wsLive = workerStatus?.wsConnected && workerStatus?.hasWorkers;
  const activeJobs = workerStatus?.activeJobs ?? 0;
  const totalCapacity = workerStatus?.totalCapacity ?? 0;
  const queuedJobs = workerStatus?.queuedJobs ?? 0;

  return (
    <nav
      style={{
        width: "100%",
        background: "var(--color-bg)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "48px",
          padding: "0 var(--space-6)",
          margin: "0 auto",
          maxWidth: "1280px",
        }}
      >
        {/* Left: title */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {title !== undefined && title !== "" && (
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                letterSpacing: "var(--tracking-tight)",
                color: "var(--color-text)",
                userSelect: "none",
              }}
            >
              {title}
            </span>
          )}
        </div>

        {/* Right: indicators + menu */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          {/* Cost indicator */}
          {totalCost !== null && totalCost !== undefined && (
            <CostLink render={render} totalCost={totalCost} />
          )}

          {/* Worker status badge */}
          {workerStatus !== undefined && (
            <WorkerBadge
              render={render}
              wsLive={wsLive}
              activeJobs={activeJobs}
              totalCapacity={totalCapacity}
              queuedJobs={queuedJobs}
            />
          )}

          {/* Nav dropdown */}
          <div ref={containerRef} style={{ position: "relative" }}>
            <MenuButton open={open} onClick={() => { setOpen((v) => !v); }} />

            {open && (
              <NavDropdown
                categories={categories}
                currentPath={currentPath}
                onSignOut={onSignOut}
                onClose={() => { setOpen(false); }}
                render={render}
              />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ── Sub-components ── */

function CostLink({
  render,
  totalCost,
}: {
  render: NonNullable<GlobalNavProps["renderLink"]>;
  totalCost: number;
}) {
  return render({
    href: "/usage",
    className: undefined,
    children: (
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          color: "var(--color-accent)",
          textDecoration: "none",
          letterSpacing: "var(--tracking-tight)",
          opacity: 0.85,
          transition: "opacity 120ms ease",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
      >
        ${totalCost.toFixed(2)}
      </span>
    ),
  });
}

function WorkerBadge({
  render,
  wsLive,
  activeJobs,
  totalCapacity,
  queuedJobs,
}: {
  render: NonNullable<GlobalNavProps["renderLink"]>;
  wsLive: boolean | undefined;
  activeJobs: number;
  totalCapacity: number;
  queuedJobs: number;
}) {
  return render({
    href: "/queue",
    children: (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "3px 10px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-subtle)",
          fontSize: "var(--text-xs)",
          color: "var(--color-text-secondary)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          transition: "background 120ms ease, border-color 120ms ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--color-bg-muted)";
          el.style.borderColor = "var(--color-border-strong)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--color-bg-subtle)";
          el.style.borderColor = "var(--color-border)";
        }}
      >
        {/* Status dot */}
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            flexShrink: 0,
            background: wsLive
              ? "var(--color-success)"
              : "var(--color-text-muted)",
            transition: "background 200ms ease",
          }}
        />
        {/* Active/capacity */}
        <span>
          <span
            style={{
              color: activeJobs > 0 ? "var(--color-success)" : undefined,
              fontWeight: activeJobs > 0 ? 500 : undefined,
            }}
          >
            {String(activeJobs)}/{String(totalCapacity)}
          </span>
          {" working"}
          {queuedJobs > 0 && (
            <span style={{ color: "var(--color-warning)", fontWeight: 500 }}>
              {" · "}{queuedJobs.toLocaleString()}{" queued"}
            </span>
          )}
        </span>
      </span>
    ),
  });
}

function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Navigation menu"
      aria-expanded={open}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        background: open ? "var(--color-bg-muted)" : "transparent",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "var(--color-bg-muted)";
        el.style.color = "var(--color-text)";
        el.style.borderColor = "var(--color-border-strong)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = open ? "var(--color-bg-muted)" : "transparent";
        el.style.color = "var(--color-text-secondary)";
        el.style.borderColor = "var(--color-border)";
      }}
    >
      <MenuIcon />
    </button>
  );
}

function NavDropdown({
  categories,
  currentPath,
  onSignOut,
  onClose,
  render,
}: {
  categories: GlobalNavCategory[];
  currentPath?: string;
  onSignOut?: () => void;
  onClose: () => void;
  render: NonNullable<GlobalNavProps["renderLink"]>;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 6px)",
        minWidth: "200px",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {categories.map((category, i) => {
        const visible = category.items.filter((item) => item.href !== currentPath);
        if (visible.length === 0) return null;

        return (
          <div key={category.label}>
            {i > 0 && (
              <div
                style={{
                  height: "1px",
                  background: "var(--color-border)",
                  margin: "2px 0",
                }}
              />
            )}
            <div
              style={{
                padding: "8px 12px 2px",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              {category.label}
            </div>
            {visible.map((item) =>
              render({
                href: item.href,
                onClick: onClose,
                className: undefined,
                children: (
                  <NavItem label={item.label} />
                ),
              }),
            )}
          </div>
        );
      })}

      {/* Sign out */}
      {onSignOut !== undefined && (
        <>
          <div
            style={{
              height: "1px",
              background: "var(--color-border)",
              margin: "2px 0",
            }}
          />
          <button
            onClick={() => { onClose(); onSignOut(); }}
            style={{
              display: "block",
              width: "100%",
              padding: "7px 12px",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              background: "transparent",
              border: "none",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "background 100ms ease, color 100ms ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "var(--color-bg-subtle)";
              el.style.color = "var(--color-text)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "transparent";
              el.style.color = "var(--color-text-secondary)";
            }}
          >
            Sign out
          </button>
        </>
      )}
    </div>
  );
}

/** A single nav item — extracted to keep hover logic DRY */
function NavItem({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "block",
        padding: "7px 12px",
        fontSize: "var(--text-sm)",
        color: "var(--color-text)",
        textDecoration: "none",
        transition: "background 100ms ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--color-bg-subtle)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {label}
    </span>
  );
}
