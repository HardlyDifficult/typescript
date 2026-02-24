import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Badge> = {
  title: "Content/Badge",
  component: Badge,
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { variant: "default", children: "Draft" },
};

export const Success: Story = {
  args: { variant: "success", children: "Merged" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Review needed" },
};

export const Error: Story = {
  args: { variant: "error", children: "Failed" },
};

export const Info: Story = {
  args: { variant: "info", children: "In progress" },
};

export const Accent: Story = {
  args: { variant: "accent", children: "New" },
};

export const Muted: Story = {
  args: { variant: "muted", children: "Archived" },
};

export const DotOnly: Story = {
  args: { variant: "success", dot: true },
};

export const DotPulse: Story = {
  args: { variant: "success", dot: true, pulse: true },
};

export const WithPulse: Story = {
  args: { variant: "error", children: "Live", pulse: true },
};
