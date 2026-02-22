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
