import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
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
