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

