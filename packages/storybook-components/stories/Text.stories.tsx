import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "../src/index.js";

const meta: Meta<typeof Text> = {
  title: "Content/Text",
  component: Text,
};
export default meta;

type Story = StoryObj<typeof Text>;

export const Document: Story = {
  render: () => (
    <div style={{ maxWidth: "480px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Text variant="heading">Build something great</Text>
      <Text variant="subheading">Focused, opinionated tools</Text>
      <Text variant="body">
        Design systems give teams a shared language. Every component is a
        decision you only make once — freeing you to focus on what makes your
        product unique. Learn more at{" "}
        <Text href="https://example.com" external>the docs</Text>.
      </Text>
      <Text variant="caption">Updated 2 minutes ago</Text>
      <Text variant="code">npm install @hardlydifficult/storybook-components</Text>
    </div>
  ),
};

export const WithColor: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Text color="default">Default text</Text>
      <Text color="secondary">Secondary text</Text>
      <Text color="muted">Muted text</Text>
      <Text color="success">Success text</Text>
      <Text color="error">Error text</Text>
      <Text color="info">Info text</Text>
      <Text color="accent">Accent text</Text>
    </div>
  ),
};
