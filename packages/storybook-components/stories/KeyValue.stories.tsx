import type { Meta, StoryObj } from "@storybook/react-vite";
import { KeyValue } from "../src/index.js";

const meta: Meta<typeof KeyValue> = {
  title: "Data/KeyValue",
  component: KeyValue,
};
export default meta;

type Story = StoryObj<typeof KeyValue>;

export const Horizontal: Story = {
  args: {
    label: "Repository",
    children: "hardlydifficult/storybook-components",
  },
};

export const Vertical: Story = {
  args: {
    label: "Description",
    direction: "vertical",
    children: "A React component library with Tailwind CSS tokens.",
  },
};
