import type { Meta, StoryObj } from "@storybook/react-vite";
import { KeyValue } from "../src/index.js";

const meta: Meta<typeof KeyValue> = {
  title: "Data/KeyValue",
  component: KeyValue,
  argTypes: {
    label: { control: "text" },
    children: { control: "text" },
    direction: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof KeyValue>;

export const Default: Story = {
  args: {
    label: "Repository",
    children: "hardlydifficult/storybook-components",
    direction: "horizontal",
  },
};

