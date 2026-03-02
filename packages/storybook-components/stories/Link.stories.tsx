import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link, Text, Stack } from "../src/index.js";

const meta: Meta<typeof Link> = {
  title: "Content/Link",
  component: Link,
  argTypes: {
    href: { control: "text" },
    external: { control: "boolean" },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Link>;

export const Default: Story = {
  args: {
    href: "https://example.com",
    children: "Example link",
  },
};

export const External: Story = {
  args: {
    href: "https://example.com",
    external: true,
    children: "Opens in new tab",
  },
};

export const InContext: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Text variant="body">
      Read the <Link href="https://example.com">documentation</Link> for setup
      instructions, or visit the{" "}
      <Link href="https://github.com" external>
        GitHub repository
      </Link>{" "}
      for source code.
    </Text>
  ),
};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack direction="vertical" gap="sm">
      <Link href="https://example.com">Internal link</Link>
      <Link href="https://example.com" external>
        External link (new tab)
      </Link>
    </Stack>
  ),
};
