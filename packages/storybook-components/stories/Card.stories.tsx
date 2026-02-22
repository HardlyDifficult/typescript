import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "../src/index.js";
import { Text } from "../src/index.js";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    padding: "md",
    children: (
      <>
        <Text variant="subheading">PR #142</Text>
        <Text variant="body">Add retry logic to webhook delivery</Text>
        <Text variant="caption">Opened 3 hours ago</Text>
      </>
    ),
  },
};

export const SmallPadding: Story = {
  args: {
    padding: "sm",
    children: <Text variant="body">Compact card content</Text>,
  },
};

export const LargePadding: Story = {
  args: {
    padding: "lg",
    children: (
      <>
        <Text variant="heading">Welcome</Text>
        <Text variant="body">
          This card has generous padding for hero-style content blocks.
        </Text>
      </>
    ),
  },
};
