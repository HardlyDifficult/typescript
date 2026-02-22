import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../src/index.js";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", children: "Deploy" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Learn more" },
};

export const Small: Story = {
  args: { variant: "primary", size: "sm", children: "Save" },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true, children: "Processing..." },
};
