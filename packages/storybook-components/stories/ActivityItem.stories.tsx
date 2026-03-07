import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActivityItem } from "../src/index.js";

const meta: Meta<typeof ActivityItem> = {
  title: "Data/ActivityItem",
  component: ActivityItem,
  argTypes: {
    summary: { control: "text" },
    timestamp: { control: "text" },
    badge: { control: "text" },
    variant: {
      control: "select",
      options: ["default", "success", "warning", "error", "info"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof ActivityItem>;

// Fixed reference point for deterministic screenshots
const NOW = new Date("2025-01-01T12:00:00.000Z");

export const Default: Story = {
  args: {
    summary: "Worker started processing request",
    timestamp: new Date(NOW.getTime() - 30 * 1000).toISOString(),
    now: NOW,
  },
};

export const Success: Story = {
  args: {
    summary: "PR #42 merged successfully",
    timestamp: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
    badge: "github",
    variant: "success",
    now: NOW,
  },
};

export const Error: Story = {
  args: {
    summary: "CI pipeline failed: 3 tests failing",
    timestamp: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
    badge: "action",
    variant: "error",
    now: NOW,
  },
};

export const Timeline: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ maxWidth: 700, border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <ActivityItem
        summary="User sent message: check PR status"
        timestamp={new Date(NOW.getTime() - 10 * 60 * 1000).toISOString()}
        badge="chat"
        variant="info"
        now={NOW}
      />
      <ActivityItem
        summary="Fetching open PRs from GitHub..."
        timestamp={new Date(NOW.getTime() - 9 * 60 * 1000).toISOString()}
        badge="github"
        now={NOW}
      />
      <ActivityItem
        summary="Found 3 open PRs"
        timestamp={new Date(NOW.getTime() - 9 * 60 * 1000).toISOString()}
        badge="github"
        variant="success"
        now={NOW}
      >
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div>#42 fix-auth-flow — ready for review</div>
          <div>#43 update-deps — CI failing</div>
          <div>#44 add-dashboard-chat — draft</div>
        </div>
      </ActivityItem>
      <ActivityItem
        summary="CI pipeline failed on #43"
        timestamp={new Date(NOW.getTime() - 8 * 60 * 1000).toISOString()}
        badge="action"
        variant="error"
        now={NOW}
      />
      <ActivityItem
        summary="Response sent to dashboard"
        timestamp={new Date(NOW.getTime() - 8 * 60 * 1000).toISOString()}
        badge="chat"
        variant="success"
        now={NOW}
      />
    </div>
  ),
};
