import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "../src/index.js";

const meta: Meta<typeof CodeBlock> = {
  title: "Content/CodeBlock",
  component: CodeBlock,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "error"],
    },
    language: { control: "text" },
    wrap: { control: "boolean" },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof CodeBlock>;

export const Default: Story = {
  args: {
    variant: "default",
    language: "typescript",
    wrap: false,
    children: `function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}`,
  },
};

export const TypeScript: Story = {
  parameters: { controls: { disable: true } },
  args: {
    language: "typescript",
    children: `import { Stack, Text } from "@hardlydifficult/storybook-components";

interface AppProps {
  title: string;
  count: number;
  enabled: boolean;
}

// Main component
function App({ title, count, enabled }: AppProps) {
  const message = \`Hello \${title}\`;
  const items = [1, 2, 3];

  if (!enabled) {
    return null;
  }

  /* Render the content */
  return (
    <Stack gap="md">
      <Text variant="heading">{message}</Text>
      <Text variant="caption">{count} items</Text>
    </Stack>
  );
}

export default App;`,
  },
};

export const ErrorVariant: Story = {
  parameters: { controls: { disable: true } },
  args: {
    variant: "error",
    language: "typescript",
    children: `TypeError: Cannot read properties of undefined (reading 'map')
    at App (App.tsx:12:18)
    at renderWithHooks (react-dom.development.js:14985:18)`,
  },
};

