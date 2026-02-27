import type { Meta, StoryObj } from "@storybook/react-vite";
import { Collapsible } from "../src/index.js";
import { Text } from "../src/index.js";
import { Button } from "../src/index.js";

const meta: Meta<typeof Collapsible> = {
  title: "Navigation/Collapsible",
  component: Collapsible,
  argTypes: {
    title: { control: "text" },
    defaultOpen: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  args: {
    title: "Advanced Settings",
    defaultOpen: false,
  },
  render: (args) => (
    // key forces remount when defaultOpen changes so the internal state resets
    <Collapsible key={String(args.defaultOpen)} title={args.title} defaultOpen={args.defaultOpen}>
      <Text>Hidden content is revealed when expanded.</Text>
    </Collapsible>
  ),
};

export const DefaultOpen: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Collapsible title="Build Details" defaultOpen>
      <Text>This section starts open.</Text>
    </Collapsible>
  ),
};

export const WithActions: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Collapsible
      title="Deployment Log"
      actions={<Button variant="ghost" size="sm">Clear</Button>}
    >
      <Text>Log entries would appear here.</Text>
    </Collapsible>
  ),
};
