import type { Meta, StoryObj } from "@storybook/react-vite";
import { Page } from "../src/index.js";
import { Section } from "../src/index.js";
import { Button } from "../src/index.js";
import { Text } from "../src/index.js";
import { Stack } from "../src/index.js";
import { Card } from "../src/index.js";
import { StatCard } from "../src/index.js";
import { Badge } from "../src/index.js";

const meta: Meta<typeof Page> = {
  title: "Layout/Page",
  component: Page,
  parameters: { layout: "fullscreen" },
  argTypes: {
    maxWidth: {
      control: "select",
      options: ["sm", "md", "lg", "full"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Page>;

export const Overview: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Page
      title="Engineering overview"
      description="Page owns the shell so the content can stay focused on actual UI."
      actions={<Button size="sm">Refresh</Button>}
    >
      <Stack direction="vertical" gap="md">
        <Text variant="caption" color="muted">
          Page provides the outer shell: a max-width container, consistent
          padding, and a header that uses the same prop names as the other
          layout primitives.
        </Text>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-4)",
          }}
        >
          <StatCard label="Open PRs" value="12" />
          <StatCard label="Merged today" value="5" trend="up" />
          <StatCard label="Failed checks" value="2" trend="down" />
        </div>
        <Section title="Recent activity">
          <Card>
            <Stack direction="vertical" gap="sm">
              <Stack direction="horizontal" gap="sm" align="center">
                <Badge variant="success">Merged</Badge>
                <Text variant="body">feat: add webhook retry logic</Text>
              </Stack>
              <Stack direction="horizontal" gap="sm" align="center">
                <Badge variant="warning">Review</Badge>
                <Text variant="body">fix: rate limiter edge case</Text>
              </Stack>
            </Stack>
          </Card>
        </Section>
      </Stack>
    </Page>
  ),
};

export const WithActions: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Page
      title="Project settings"
      description="Use `actions` instead of a one-off header prop name."
      actions={
        <Stack direction="horizontal" gap="sm">
          <Button variant="secondary" size="sm">
            Cancel
          </Button>
          <Button size="sm">Save changes</Button>
        </Stack>
      }
    >
      <Section title="General">
        <Card>
          <Text variant="body">
            `actions` places buttons in the top-right corner, aligned with the
            page title.
          </Text>
        </Card>
      </Section>
    </Page>
  ),
};
