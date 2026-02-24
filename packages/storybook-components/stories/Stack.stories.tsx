import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../src/index.js";
import { Button } from "../src/index.js";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Stack> = {
  title: "Layout/Stack",
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

export const GridColumns: Story = {
  args: {
    columns: 4,
    gap: "md",
    children: (
      <>
        <Badge variant="success">Cell 1</Badge>
        <Badge variant="info">Cell 2</Badge>
        <Badge variant="warning">Cell 3</Badge>
        <Badge variant="error">Cell 4</Badge>
      </>
    ),
  },
};
