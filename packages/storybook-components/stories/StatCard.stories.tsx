import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCard } from "../src/index.js";

const meta: Meta<typeof StatCard> = {
  title: "Data/StatCard",
  component: StatCard,
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    trend: { control: "number" },
    caption: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    label: "Monthly Revenue",
    value: "$84,200",
    trend: 12.5,
    caption: "vs last 30 days",
  },
};

export const Revenue: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <StatCard label="Monthly Revenue" value="$84,200" trend={12.5} caption="vs last 30 days" />
  ),
};

export const ActiveUsers: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <StatCard label="Active Users" value="12,459" trend={8.2} caption="past 7 days" />
  ),
};

export const ErrorRate: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <StatCard label="Error Rate" value="0.3%" trend={-41.0} caption="vs last week" />
  ),
};

export const NoTrend: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <StatCard label="API Requests" value="2.4M" />
  ),
};
