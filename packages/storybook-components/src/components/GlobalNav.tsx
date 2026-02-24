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
  title?: string;
  currentPath?: string;
  categories: GlobalNavCategory[];
  indicators?: ReactNode;
  onSignOut?: () => void;
  renderLink?: (props: {
    href: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => ReactNode;
}

function DefaultLink({ href, children, className, onClick }: {
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
 * Render the app-level top navigation with optional status indicators and a menu dropdown.
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
    <nav className="w-full bg-[color:var(--color-bg)]/90 border-b border-[color:var(--color-border)] shadow-[var(--shadow-sm)] font-[family-name:var(--font-sans)] backdrop-blur-sm">
      <div className="flex items-center justify-between h-13 px-[var(--space-6)] mx-auto max-w-[1280px]">
        <div className="flex items-center">
          {title !== undefined && title !== "" && (
            <span className="text-[length:var(--text-sm)] font-semibold tracking-[var(--tracking-tight)] text-[color:var(--color-text)] select-none">
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-[var(--space-3)]">
          {indicators}
          <div ref={containerRef} className="relative">
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

function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Navigation menu"
      aria-expanded={open}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] bg-[color:var(--color-bg)] hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] transition-colors duration-150 cursor-pointer"
      style={{ background: open ? "var(--color-bg-muted)" : undefined }}
    >
      <MenuIcon />
    </button>
  );
}
