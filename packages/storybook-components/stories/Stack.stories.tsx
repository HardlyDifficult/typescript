import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../src/index.js";
import { Button } from "../src/index.js";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Stack> = {
  title: "Components/Stack",
  component: Stack,
};
export default meta;

type Story = StoryObj<typeof Stack>;

export const Vertical: Story = {
  args: {
    direction: "vertical",
    gap: "md",
    children: (
      <>
        <Badge variant="success">Build passing</Badge>
        <Badge variant="info">Tests running</Badge>
        <Badge variant="warning">Review pending</Badge>
      </>
    ),
  },
};

export const Horizontal: Story = {
  args: {
    direction: "horizontal",
    gap: "sm",
    children: (
      <>
        <Button variant="primary" size="sm">
          Approve
        </Button>
        <Button variant="secondary" size="sm">
          Request changes
        </Button>
        <Button variant="ghost" size="sm">
          Dismiss
        </Button>
      </>
    ),
  },
};
