import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextViewer } from "../src/index.js";

const meta: Meta<typeof TextViewer> = {
  title: "Content/TextViewer",
  component: TextViewer,
  argTypes: {
    content: { control: "text" },
    json: { control: "object" },
    defaultMode: {
      control: "select",
      options: ["text", "markdown", "json"],
    },
    onChange: { control: false },
    autoScroll: { control: false },
  },
};
export default meta;

type Story = StoryObj<typeof TextViewer>;

export const Markdown: Story = {
  args: {
    content: `# Hello world

This is a **markdown** document with _italic_ text and \`inline code\`.

## Features

- Multi-mode viewing
- Syntax highlighted code blocks
- JSON tree explorer

\`\`\`typescript
const greeting = (name: string) => \`Hello, \${name}!\`;
\`\`\`
`,
    defaultMode: "markdown",
  },
};

export const Json: Story = {
  args: {
    json: {
      id: "evt_123",
      type: "workflow.completed",
      status: "success",
      duration: 4200,
      steps: ["plan", "execute", "review"],
    },
    defaultMode: "json",
  },
};
