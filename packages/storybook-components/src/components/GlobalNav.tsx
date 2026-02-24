'use client';

import { type ReactNode, useEffect, useRef, useState } from "react";

import { NavDropdown } from "./GlobalNavDropdown";

export interface GlobalNavLink {
  href: string;
  label: string;
}

export interface GlobalNavCategory {
  label: string;
  items: GlobalNavLink[];
}

export interface GlobalNavProps {
  /** Application title shown on the left side */
  title?: string;
  /** Current page path — that nav item is hidden from the dropdown */
  currentPath?: string;
  /** Navigation categories and their links */
  categories: GlobalNavCategory[];
  /** Custom content rendered between the title and the menu button (status badges, etc.) */
  indicators?: ReactNode;
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
 * Global navigation bar.
 * Renders a top bar with a title on the left, optional custom indicators, and a nav dropdown.
 * All styling comes from the design system tokens; consumers provide business logic via props.
 */
export function GlobalNav({
  title,
  currentPath,
  categories,
  indicators,
  onSignOut,
  renderLink,
}: GlobalNavProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = renderLink ?? ((p) => <DefaultLink {...p} />);

  useEffect(() => {
    if (!open) {return;}

    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {setOpen(false);}
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
          {indicators}

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
