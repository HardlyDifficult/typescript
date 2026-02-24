import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "../src/index.js";

const meta: Meta<typeof CodeBlock> = {
  title: "Content/CodeBlock",
  component: CodeBlock,
};
export default meta;

type Story = StoryObj<typeof CodeBlock>;

export const Default: Story = {
  args: {
    language: "typescript",
    children: `import { Stack, Text } from "@hardlydifficult/storybook-components";

function App() {
  return (
    <Stack gap="md">
      <Text variant="heading">Hello</Text>
    </Stack>
  );
}`,
  },
};

export const WithWrap: Story = {
  args: {
    language: "json",
    wrap: true,
    children: `{"name":"@hardlydifficult/storybook-components","version":"0.0.1","description":"A long description that might wrap around when the container is narrow enough to cause wrapping behavior in the code block"}`,
  },
};
