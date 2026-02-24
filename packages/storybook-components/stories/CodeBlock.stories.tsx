import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "../src/index.js";

const meta: Meta<typeof CodeBlock> = {
  title: "Content/CodeBlock",
  component: CodeBlock,
};
export default meta;

type Story = StoryObj<typeof CodeBlock>;

export const TypeScript: Story = {
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

export const JavaScript: Story = {
  args: {
    language: "js",
    children: `const express = require('express');
const app = express();

// Start server on port 3000
app.get('/api/health', async (req, res) => {
  const status = { ok: true, uptime: 42.5 };
  res.json(status);
});

app.listen(3000);`,
  },
};

export const PlainText: Story = {
  args: {
    children: `This is plain text without any syntax highlighting.
It still has line numbers and the copy button.
No language prop is set.`,
  },
};

export const WithWrap: Story = {
  args: {
    language: "json",
    wrap: true,
    children: `{"name":"@hardlydifficult/storybook-components","version":"0.0.1","description":"A long description that might wrap around when the container is narrow enough to cause wrapping behavior in the code block"}`,
  },
};
