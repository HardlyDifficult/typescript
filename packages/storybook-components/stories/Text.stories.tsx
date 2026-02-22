import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "../src/index.js";

const meta: Meta<typeof Text> = {
  title: "Components/Text",
  component: Text,
};
export default meta;

type Story = StoryObj<typeof Text>;

export const Heading: Story = {
  args: { variant: "heading", children: "Build something great" },
};

export const Subheading: Story = {
  args: { variant: "subheading", children: "Focused, opinionated tools" },
};

export const Body: Story = {
  args: {
    variant: "body",
    children:
      "Design systems give teams a shared language. Every component is a decision you only make once.",
  },
};

export const Caption: Story = {
  args: { variant: "caption", children: "Updated 2 minutes ago" },
};

export const Code: Story = {
  args: { variant: "code", children: "npm install @hardlydifficult/storybook-components" },
};
