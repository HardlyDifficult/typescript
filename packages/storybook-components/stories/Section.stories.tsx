import type { Meta, StoryObj } from "@storybook/react-vite";
import { Section } from "../src/index.js";
import { Text } from "../src/index.js";
import { Button } from "../src/index.js";
import { Stack } from "../src/index.js";
import { Badge } from "../src/index.js";
import { KeyValue } from "../src/index.js";

const meta: Meta<typeof Section> = {
  title: "Layout/Section",
  component: Section,
};
export default meta;

type Story = StoryObj<typeof Section>;

export const Default: Story = {
  render: () => (
    <Section title="Recent activity" subtitle="Last 24 hours">
      <Stack direction="vertical" gap="sm">
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="success">Deployed</Badge>
          <Text variant="body">v2.4.1 pushed to production</Text>
          <Text variant="caption" color="muted">2 hours ago</Text>
        </Stack>
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="warning">Pending</Badge>
          <Text variant="body">Database migration queued</Text>
          <Text variant="caption" color="muted">5 hours ago</Text>
        </Stack>
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="info">Review</Badge>
          <Text variant="body">Auth refactor ready for review</Text>
          <Text variant="caption" color="muted">8 hours ago</Text>
        </Stack>
      </Stack>
    </Section>
  ),
};

export const WithActions: Story = {
  render: () => (
    <Section
      title="Team members"
      subtitle="3 active"
      actions={
        <Stack direction="horizontal" gap="sm">
          <Button variant="ghost" size="sm">Manage</Button>
          <Button size="sm">Invite</Button>
        </Stack>
      }
    >
      <Stack direction="vertical" gap="sm">
        <KeyValue label="Alice Chen">Owner</KeyValue>
        <KeyValue label="Bob Park">Admin</KeyValue>
        <KeyValue label="Carol Liu">Member</KeyValue>
      </Stack>
    </Section>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Section
      title="Build queue"
      footer={<Text variant="caption" color="muted">Showing 2 of 14 builds</Text>}
    >
      <Stack direction="vertical" gap="sm">
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="success" dot pulse />
          <Text variant="body">main — build #482</Text>
        </Stack>
        <Stack direction="horizontal" gap="sm" align="center">
          <Badge variant="default" dot />
          <Text variant="body">feature/auth — build #481</Text>
        </Stack>
      </Stack>
    </Section>
  ),
};
