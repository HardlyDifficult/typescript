import type { Meta, StoryObj } from "@storybook/react-vite";
import { GlobalNav } from "../src/index.js";

const NAV_CATEGORIES = [
  {
    label: "Core",
    items: [
      { href: "/", label: "PR Dashboard" },
      { href: "/sessions", label: "Claude Sessions" },
      { href: "/queue", label: "Queue Viewer" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/activity", label: "Activity Log" },
      { href: "/usage", label: "Usage Dashboard" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/prompt-tester", label: "Prompt Tester" },
      { href: "/config", label: "Config" },
    ],
  },
];

const meta: Meta<typeof GlobalNav> = {
  title: "Components/GlobalNav",
  component: GlobalNav,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    title: "PR Dashboard",
    categories: NAV_CATEGORIES,
    onSignOut: () => { alert("Sign out clicked"); },
  },
};
export default meta;

type Story = StoryObj<typeof GlobalNav>;

/** Default state: connected with active jobs. */
export const Default: Story = {
  args: {
    currentPath: "/",
    totalCost: 12.34,
    workerStatus: {
      activeJobs: 2,
      totalCapacity: 4,
      queuedJobs: 0,
      wsConnected: true,
      hasWorkers: true,
    },
  },
};

/** Disconnected — no workers registered. */
export const Disconnected: Story = {
  args: {
    currentPath: "/",
    totalCost: null,
    workerStatus: {
      activeJobs: 0,
      totalCapacity: 0,
      queuedJobs: 0,
      wsConnected: false,
      hasWorkers: false,
    },
  },
};

/** Backlogged — jobs queued up. */
export const WithQueue: Story = {
  args: {
    currentPath: "/sessions",
    totalCost: 89.50,
    workerStatus: {
      activeJobs: 4,
      totalCapacity: 4,
      queuedJobs: 12,
      wsConnected: true,
      hasWorkers: true,
    },
  },
};

/** Minimal — no status indicators. */
export const Minimal: Story = {
  args: {
    currentPath: "/config",
    totalCost: null,
    workerStatus: undefined,
  },
};
