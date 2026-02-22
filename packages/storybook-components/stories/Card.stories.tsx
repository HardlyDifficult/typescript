import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "../src/index.js";
import { Text } from "../src/index.js";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <>
        <Text variant="subheading">PR #142</Text>
        <Text variant="body">Add retry logic to webhook delivery</Text>
        <Text variant="caption">Opened 3 hours ago</Text>
      </>
    ),
  },
};

export const WithHeading: Story = {
  args: {
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

export const WithTitle: Story = {
  render: () => (
    <Card title="Team Members">
      <Text variant="body">Three engineers, one designer, and a product lead.</Text>
    </Card>
  ),
};

export const WithTitleAndFooter: Story = {
  render: () => (
    <Card
      title="Deployment Status"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="caption">Last deployed 2 minutes ago</Text>
          <Badge variant="success">Live</Badge>
        </div>
      }
    >
      <Text variant="body">v2.4.1 is running on 4 instances across us-east-1.</Text>
    </Card>
  ),
};
