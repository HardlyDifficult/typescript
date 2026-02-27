import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Badge> = {
  title: "Content/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "error", "info", "accent", "muted"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    dot: { control: "boolean" },
    pulse: { control: "boolean" },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { variant: "success", children: "Merged", size: "md", dot: false, pulse: false },
};

export const DotWithText: Story = {
  parameters: { controls: { disable: true } },
  args: { variant: "error", children: "Live", dot: true, pulse: true, size: "md" },
};

export const DotOnly: Story = {
  parameters: { controls: { disable: true } },
  args: { variant: "success", dot: true, pulse: false, size: "md" },
};

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      <Badge variant="default">Draft</Badge>
      <Badge variant="success">Merged</Badge>
      <Badge variant="warning">Review</Badge>
      <Badge variant="error">Failed</Badge>
      <Badge variant="info">In progress</Badge>
      <Badge variant="accent">New</Badge>
      <Badge variant="muted">Archived</Badge>
    </div>
  ),
};
