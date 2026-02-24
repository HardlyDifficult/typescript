import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../src/index.js";
import { Text } from "../src/index.js";
import { Stack } from "../src/index.js";

const meta: Meta<typeof Button> = {
  title: "Inputs/Button",
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Text variant="body">Ready to ship?</Text>
      <Button>Deploy</Button>
    </Stack>
  ),
};

export const Secondary: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Text variant="body">Unsaved changes</Text>
      <Button variant="secondary">Cancel</Button>
      <Button>Save</Button>
    </Stack>
  ),
};

export const Ghost: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Text variant="caption" color="muted">3 more items</Text>
      <Button variant="ghost" size="sm">Show all</Button>
    </Stack>
  ),
};

export const Danger: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Text variant="body">This action cannot be undone.</Text>
      <Button variant="danger">Delete</Button>
    </Stack>
  ),
};

export const Small: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Text variant="caption" color="secondary">Filter applied</Text>
      <Button size="sm">Clear</Button>
      <Button variant="secondary" size="sm">Edit</Button>
    </Stack>
  ),
};

export const Loading: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Button loading>Deploying</Button>
      <Text variant="caption" color="muted">This may take a moment...</Text>
    </Stack>
  ),
};

export const LinkVariant: Story = {
  render: () => (
    <Text variant="body">
      See the <Button variant="link">documentation</Button> for details.
    </Text>
  ),
};

// A simple plus icon
const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const WithIcon: Story = {
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Button variant="secondary" icon={<PlusIcon />}>New branch</Button>
      <Text variant="caption" color="muted">from main</Text>
    </Stack>
  ),
};
