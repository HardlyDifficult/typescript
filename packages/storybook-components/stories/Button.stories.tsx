import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../src/index.js";
import { Text } from "../src/index.js";
import { Stack } from "../src/index.js";

const meta: Meta<typeof Button> = {
  title: "Inputs/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger", "link"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    variant: "primary",
    size: "md",
    children: "Deploy",
  },
};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="link">Link</Button>
    </Stack>
  ),
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Button size="md">Medium</Button>
      <Button size="sm">Small</Button>
    </Stack>
  ),
};

export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Button>Default</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </Stack>
  ),
};

export const InContext: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack direction="horizontal" gap="sm" align="center">
      <Text variant="body">Unsaved changes</Text>
      <Button variant="secondary">Cancel</Button>
      <Button>Save</Button>
    </Stack>
  ),
};

export const LinkVariant: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Text variant="body">
      See the <Button variant="link">documentation</Button> for details.
    </Text>
  ),
};
