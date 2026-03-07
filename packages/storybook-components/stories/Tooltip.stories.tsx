import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tooltip, Button } from "../src/index.js";

const meta: Meta<typeof Tooltip> = {
  title: "Feedback/Tooltip",
  component: Tooltip,
  argTypes: {
    content: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: {
    content: "This is a tooltip.",
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="secondary">Hover me</Button>
    </Tooltip>
  ),
};

export const OnIcon: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
      <Tooltip content="Delete this item permanently.">
        <Button variant="danger">Delete</Button>
      </Tooltip>
      <Tooltip content="Save your changes before leaving.">
        <Button>Save</Button>
      </Tooltip>
      <Tooltip content="This action cannot be undone.">
        <Button variant="secondary">Archive</Button>
      </Tooltip>
    </div>
  ),
};

