'use client';

import React, { type ReactNode } from "react";

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
    <div className="absolute right-0 top-[calc(100%+9px)] min-w-[230px] bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 overflow-hidden p-[var(--space-2)]">
      {categories.map((category, i) => {
        const visible = category.items.filter((item) => item.href !== currentPath);
        if (visible.length === 0) {return null;}

        return (
          <div key={category.label}>
            {i > 0 && <div className="h-px bg-[color:var(--color-border)] my-[var(--space-2)]" />}
            <div className="px-[var(--space-3)] pt-[var(--space-1)] pb-[var(--space-2)] text-[11px] font-semibold tracking-[0.08em] uppercase text-[color:var(--color-text-muted)]">
              {category.label}
            </div>
            {visible.map((item) => (
              <React.Fragment key={item.href}>
                {render({
                  href: item.href,
                  onClick: onClose,
                  className: undefined,
                  children: <NavItem label={item.label} />,
                })}
              </React.Fragment>
            ))}
          </div>
        );
      })}

      {onSignOut !== undefined && (
        <>
          <div className="h-px bg-[color:var(--color-border)] my-[var(--space-2)]" />
          <button
            onClick={() => { onClose(); onSignOut(); }}
            className="block w-full px-[var(--space-3)] py-[0.5rem] rounded-[var(--radius-md)] text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-text)] border-none text-left cursor-pointer font-[family-name:var(--font-sans)] transition-colors"
          >
            Sign out
          </button>
        </>
      )}
    </div>
  );
}

function NavItem({ label }: { label: string }) {
  return (
    <span className="block px-[var(--space-3)] py-[0.5rem] rounded-[var(--radius-md)] text-[length:var(--text-sm)] text-[color:var(--color-text)] hover:bg-[color:var(--color-bg-subtle)] transition-colors cursor-pointer">
      {label}
    </span>
  );
}
