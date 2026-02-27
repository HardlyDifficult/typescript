import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../src/index.js";
import { Button } from "../src/index.js";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Stack> = {
  title: "Layout/Stack",
  component: Stack,
  argTypes: {
    direction: {
      control: "select",
      options: ["vertical", "horizontal"],
    },
    gap: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
    },
    align: {
      control: "select",
      options: ["start", "center", "end", "baseline", "stretch"],
    },
    wrap: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Stack>;

export const Default: Story = {
  args: {
    direction: "vertical",
    gap: "md",
    align: "stretch",
    wrap: false,
    children: "Stack content",
  },
};

export const Vertical: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack direction="vertical" gap="md">
      <Badge variant="success">Build passing</Badge>
      <Badge variant="info">Tests running</Badge>
      <Badge variant="warning">Review pending</Badge>
    </Stack>
  ),
};

export const Horizontal: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack direction="horizontal" gap="sm">
      <Button variant="primary" size="sm">
        Approve
      </Button>
      <Button variant="secondary" size="sm">
        Request changes
      </Button>
      <Button variant="ghost" size="sm">
        Dismiss
      </Button>
    </Stack>
  ),
};
