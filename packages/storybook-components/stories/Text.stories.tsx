import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "../src/index.js";

const meta: Meta<typeof Text> = {
  title: "Components/Text",
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
        product unique.
      </Text>
      <Text variant="caption">Updated 2 minutes ago</Text>
      <Text variant="code">npm install @hardlydifficult/storybook-components</Text>
    </div>
  ),
};

export const Heading: Story = {
  args: { variant: "heading", children: "Build something great" },
};

export const Subheading: Story = {
  args: { variant: "subheading", children: "Focused, opinionated tools" },
};

export const Body: Story = {
  args: {
    variant: "body",
    children:
      "Design systems give teams a shared language. Every component is a decision you only make once.",
  },
};

export const Caption: Story = {
  args: { variant: "caption", children: "Updated 2 minutes ago" },
};

export const Code: Story = {
  args: { variant: "code", children: "npm install @hardlydifficult/storybook-components" },
};
