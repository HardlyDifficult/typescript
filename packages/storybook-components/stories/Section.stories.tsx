import type { Meta, StoryObj } from "@storybook/react-vite";
import { Section } from "../src/index.js";
import { Button } from "../src/index.js";
import { Stack } from "../src/index.js";
import { KeyValue } from "../src/index.js";

const meta: Meta<typeof Section> = {
  title: "Layout/Section",
  component: Section,
  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Section>;

export const Default: Story = {
  args: {
    title: "Recent activity",
    subtitle: "Last 24 hours",
    children: "Section content goes here.",
  },
};

export const WithActions: Story = {
  parameters: { controls: { disable: true } },
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

