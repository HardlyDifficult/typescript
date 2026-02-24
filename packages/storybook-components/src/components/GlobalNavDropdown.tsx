'use client';

import { type ReactNode } from "react";

type RenderLink = (props: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => ReactNode;

interface NavDropdownCategory {
  label: string;
  items: { href: string; label: string }[];
}

export function NavDropdown({
  categories,
  currentPath,
  onSignOut,
  onClose,
  render,
}: {
  categories: NavDropdownCategory[];
  currentPath?: string;
  onSignOut?: () => void;
  onClose: () => void;
  render: RenderLink;
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
