import type { Meta, StoryObj } from "@storybook/react-vite";
import { GlobalNav } from "../src/index.js";

const NAV_CATEGORIES = [
  {
    label: "Core",
    items: [
      { href: "/", label: "Home" },
      { href: "/sessions", label: "Sessions" },
      { href: "/jobs", label: "Jobs" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/activity", label: "Activity" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/prompt-tester", label: "Prompt Tester" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

/** A simple status badge for demo purposes — consumers supply their own via `indicators`. */
function StatusBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-subtle)",
        fontSize: "var(--text-xs)",
        color: "var(--color-text-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          flexShrink: 0,
          background: connected ? "var(--color-success)" : "var(--color-text-muted)",
        }}
      />
      {label}
    </span>
  );
}

const meta: Meta<typeof GlobalNav> = {
  title: "Components/GlobalNav",
  component: GlobalNav,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    title: "My App",
    categories: NAV_CATEGORIES,
    onSignOut: () => { alert("Sign out clicked"); },
  },
};
export default meta;

type Story = StoryObj<typeof GlobalNav>;

/** Default state: custom indicators showing active status. */
export const Default: Story = {
  args: {
    currentPath: "/",
    indicators: <StatusBadge connected={true} label="2 / 4 active" />,
  },
};

/** Disconnected — status indicator reflects an offline state. */
export const Disconnected: Story = {
  args: {
    currentPath: "/",
    indicators: <StatusBadge connected={false} label="offline" />,
  },
};

/** Multiple indicators — compose as many as needed. */
export const MultipleIndicators: Story = {
  args: {
    currentPath: "/sessions",
    indicators: (
      <>
        <StatusBadge connected={true} label="4 / 4 active · 12 queued" />
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--color-accent)",
            opacity: 0.85,
          }}
        >
          $89.50
        </span>
      </>
    ),
  },
};

/** Minimal — no status indicators. */
export const Minimal: Story = {
  args: {
    currentPath: "/settings",
  },
};
