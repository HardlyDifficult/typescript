import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActivityFeed } from "../src/index.js";
import type { ActivityEvent } from "../src/index.js";

const meta: Meta<typeof ActivityFeed> = {
  title: "Widgets/ActivityFeed",
  component: ActivityFeed,
};
export default meta;

type Story = StoryObj<typeof ActivityFeed>;

const now = Date.now();
const minute = 60_000;
const hour = 3_600_000;

const sampleEvents: ActivityEvent[] = [
  {
    id: "1",
    message: "Merged PR #142: Add retry logic",
    timestamp: new Date(now - 2 * minute),
    status: "success",
    actor: { name: "Alice Chen" },
    detail: "3 files changed, +47 -12",
  },
  {
    id: "2",
    message: "CI build failed on main",
    timestamp: new Date(now - 15 * minute),
    status: "error",
    actor: { name: "Bot" },
    detail: "Exit code 1 — test suite timeout",
  },
  {
    id: "3",
    message: "Review requested on PR #158",
    timestamp: new Date(now - 1 * hour),
    status: "warning",
    actor: { name: "Jordan Liu" },
  },
  {
    id: "4",
    message: "Deployed v2.4.1 to production",
    timestamp: new Date(now - 3 * hour),
    status: "info",
    actor: { name: "Deploy Bot" },
    detail: "Region: us-east-1",
  },
  {
    id: "5",
    message: "Waiting for approval on PR #160",
    timestamp: new Date(now - 5 * hour),
    status: "pending",
    actor: { name: "Sam Park" },
  },
];

const systemEvents: ActivityEvent[] = [
  {
    id: "s1",
    message: "Scheduled backup completed",
    timestamp: new Date(now - 3 * minute),
    status: "success",
    detail: "4.2 GB archived to cold storage",
    // NO actor — shows status icon
  },
  {
    id: "s2",
    message: "Opened PR #163: Migrate auth to OAuth2",
    timestamp: new Date(now - 18 * minute),
    status: "info",
    actor: { name: "Alex Rivera" },
    // WITH actor — shows avatar
  },
  {
    id: "s3",
    message: "Memory threshold exceeded on worker-3",
    timestamp: new Date(now - 42 * minute),
    status: "warning",
    detail: "92% of 8 GB used",
    // NO actor — shows status icon
  },
  {
    id: "s4",
    message: "Closed PR #151: Remove legacy API",
    timestamp: new Date(now - 2 * hour),
    status: "success",
    actor: { name: "Morgan Taylor" },
    detail: "–312 lines removed",
    // WITH actor — shows avatar
  },
  {
    id: "s5",
    message: "SSL certificate renewal failed",
    timestamp: new Date(now - 4 * hour),
    status: "error",
    detail: "Domain validation error on api.example.com",
    // NO actor — shows status icon
  },
  {
    id: "s6",
    message: "Kicked off nightly test suite",
    timestamp: new Date(now - 8 * hour),
    status: "pending",
    actor: { name: "CI Scheduler" },
    // WITH actor — shows avatar
  },
];

export const Default: Story = {
  args: {
    events: sampleEvents,
    title: "Recent Activity",
  },
};

export const Empty: Story = {
  args: {
    events: [],
    title: "Activity",
  },
};

export const SystemEvents: Story = {
  args: {
    events: systemEvents,
    title: "System Log",
  },
};
