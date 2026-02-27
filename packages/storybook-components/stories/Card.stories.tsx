import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "../src/index.js";
import { Text } from "../src/index.js";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Card> = {
  title: "Layout/Card",
  component: Card,
  argTypes: {
    title: { control: "text" },
    interactive: { control: "boolean" },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: "Card content goes here.",
  },
};

export const PullRequest: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Card>
      <Text variant="subheading">PR #142</Text>
      <Text variant="body">Add retry logic to webhook delivery</Text>
      <Text variant="caption">Opened 3 hours ago</Text>
    </Card>
  ),
};

export const WithTitle: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Card title="Team Members">
      <Text variant="body">Three engineers, one designer, and a product lead.</Text>
    </Card>
  ),
};

export const WithTitleAndFooter: Story = {
  parameters: { controls: { disable: true } },
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
