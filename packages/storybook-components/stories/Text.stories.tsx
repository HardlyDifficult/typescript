import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link, Text } from "../src/index.js";

const meta: Meta<typeof Text> = {
  title: "Content/Text",
  component: Text,
  argTypes: {
    variant: {
      control: "select",
      options: ["heading", "subheading", "body", "caption", "code"],
    },
    color: {
      control: "select",
      options: ["default", "secondary", "muted", "success", "error", "info", "accent"],
    },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Text>;

export const Default: Story = {
  args: {
    variant: "body",
    children: "The quick brown fox jumps over the lazy dog.",
  },
};

export const Document: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ maxWidth: "480px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Text variant="heading">Build something great</Text>
      <Text variant="subheading">Focused, opinionated tools</Text>
      <Text variant="body">
        Design systems give teams a shared language. Every component is a
        decision you only make once — freeing you to focus on what makes your
        product unique. Learn more at{" "}
        <Link href="https://example.com" external>the docs</Link>.
      </Text>
      <Text variant="caption">Updated 2 minutes ago</Text>
      <Text variant="code">npm install @hardlydifficult/storybook-components</Text>
      <Text variant="body" color="success">Your changes have been saved.</Text>
      <Text variant="body" color="error">Something went wrong, please try again.</Text>
      <Text variant="body" color="info">This action will affect all team members.</Text>
      <Text variant="body" color="muted">Last updated by system.</Text>
    </div>
  ),
};
