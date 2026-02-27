import type { ReactNode } from "react";

interface LinkProps {
  href: string;
  external?: boolean;
  children: ReactNode;
}

/** Inline anchor styled to the accent color. Use `external` to open in a new tab. */
export function Link({ href, external, children }: LinkProps) {
  return (
    <a
      href={href}
      className="text-[color:var(--color-accent)] no-underline hover:underline font-[family-name:var(--font-sans)] text-sm"
      {...(external === true ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
